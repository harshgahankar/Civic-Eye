"""
app/api/processing.py

Video processing API endpoints.

POST /api/v1/processing/video    — start a processing job (non-blocking)
GET  /api/v1/processing/{job_id} — query job status

Jobs run in FastAPI BackgroundTasks so the HTTP request returns immediately.
An in-memory registry tracks all active and completed jobs.
"""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import Response

from app.core.logging import get_logger
from app.schemas.tracking import JobStatus, StartJobRequest, StartJobResponse

logger = get_logger(__name__)
router = APIRouter(prefix="/processing", tags=["processing"])

# ── In-memory job registry ────────────────────────────────────────────────────
# Thread-safe access via _registry_lock (background thread + HTTP handler)
_registry: Dict[str, JobStatus] = {}
_registry_lock = threading.Lock()


def _get_job(job_id: str) -> JobStatus:
    with _registry_lock:
        job = _registry.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "JOB_NOT_FOUND", "message": f"Job '{job_id}' was not found"},
        )
    return job


def _update_job(job: JobStatus) -> None:
    with _registry_lock:
        _registry[job.job_id] = job


# ── Background worker ─────────────────────────────────────────────────────────

def _run_pipeline(job: JobStatus, output_path: str) -> None:
    """
    Execute the full pipeline in a background thread.
    Updates job status in the registry throughout execution.
    """
    # Import here to avoid heavy imports at module load time
    from app.ai.inference import InferenceEngine
    from app.pipeline.pipeline_manager import PipelineManager

    job.status = "RUNNING"
    job.started_at = datetime.now(timezone.utc)
    _update_job(job)
    logger.info("Job [%s] started for camera %s", job.job_id, job.camera_id)

    def _progress(frame_num: int, total_dets: int, fps: float, active: int) -> None:
        job.frames_processed = frame_num
        job.detections_count = total_dets
        job.average_fps = round(fps, 2)
        _update_job(job)

    try:
        engine = InferenceEngine()
        manager = PipelineManager(engine=engine, progress_callback=_progress)
        result = manager.process_video(
            video_path=job.source,
            camera_id=job.camera_id,
            output_path=output_path,
            job_id=job.job_id,
        )

        job.status = result.status           # COMPLETED or FAILED
        job.frames_processed = result.frames_processed
        job.detections_count = result.detections_count
        job.behavior_events_count = result.behavior_events_count
        job.average_fps = result.average_fps
        job.output_path = result.output_path
        job.completed_at = result.completed_at
        if result.error:
            job.error = result.error

    except Exception as exc:
        logger.exception("Job [%s] raised unhandled exception", job.job_id)
        job.status = "FAILED"
        job.error = str(exc)
        job.completed_at = datetime.now(timezone.utc)

    _update_job(job)
    logger.info("Job [%s] → %s", job.job_id, job.status)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/video",
    response_model=StartJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start a video processing job",
)
def start_video_job(
    payload: StartJobRequest,
    background_tasks: BackgroundTasks,
) -> StartJobResponse:
    """
    Accept a local video path and start processing asynchronously.
    Returns a job_id immediately; poll GET /processing/{job_id} for status.
    """
    # Determine output path
    if payload.output_path:
        output_path = payload.output_path
    else:
        stem = Path(payload.video_path).stem
        out_dir = Path("data") / "videos" / "outputs"
        out_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(out_dir / f"{stem}_tracked.mp4")

    job_id = f"JOB-{uuid.uuid4().hex[:8].upper()}"
    job = JobStatus(
        job_id=job_id,
        camera_id=payload.camera_id,
        status="QUEUED",
        source=payload.video_path,
        output_path=output_path,
    )
    _update_job(job)
    logger.info("Job [%s] queued: %s", job_id, payload.video_path)

    # Run in background — does NOT block the HTTP response
    background_tasks.add_task(_run_pipeline, job, output_path)

    return StartJobResponse(
        status="started",
        camera_id=payload.camera_id,
        source=payload.video_path,
        job_id=job_id,
    )


@router.get(
    "/{job_id}",
    response_model=JobStatus,
    summary="Get processing job status",
)
def get_job_status(job_id: str) -> JobStatus:
    """Return the current status of a processing job."""
    return _get_job(job_id)


@router.get(
    "",
    response_model=list[JobStatus],
    summary="List all processing jobs",
)
def list_jobs() -> list[JobStatus]:
    """Return all jobs in the in-memory registry."""
    with _registry_lock:
        return list(_registry.values())


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a job from the registry",
)
def delete_job(job_id: str) -> Response:
    """Remove a completed or failed job from the in-memory registry."""
    _get_job(job_id)  # raises 404 if missing
    with _registry_lock:
        del _registry[job_id]
    return Response(status_code=status.HTTP_204_NO_CONTENT)
