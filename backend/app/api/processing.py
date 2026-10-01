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
from typing import Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.api.incidents import IncidentSummary, _to_summary
from app.core.logging import get_logger
from app.db.database import get_db
from app.db.models import Incident as IncidentRow
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
        job.incidents_count = result.incidents_count
        job.confirmed_incidents_count = result.confirmed_incidents_count
        job.false_alarm_count = result.false_alarm_count
        job.average_fps = result.average_fps
        job.output_path = result.output_path
        job.completed_at = result.completed_at
        try:
            job.incident_ids = [i.incident_id for i in result.all_incidents]
        except Exception:
            job.incident_ids = []
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
    "/{job_id}/video",
    summary="Stream the finished job's tracked video (browser-playable MP4)",
)
def get_job_video(
    job_id: str,
    download: bool = Query(default=False, description="Set Content-Disposition to attachment"),
) -> FileResponse:
    """Stream the annotated output video for inline <video> preview.

    Resolves the stored (possibly relative) output_path against the backend
    working directory and package layout, so preview works regardless of
    whether the server was started from backend/ or the repo root.
    """
    job = _get_job(job_id)
    if not job.output_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "VIDEO_NOT_READY", "message": f"Job '{job_id}' has no output video yet"},
        )
    stored = Path(job.output_path)
    candidates: list[Path] = []
    if stored.is_absolute():
        candidates.append(stored)
    else:
        cwd = Path.cwd()
        backend_dir = Path(__file__).resolve().parents[2]  # backend/
        repo_root = backend_dir.parent
        candidates.extend([
            cwd / stored,
            backend_dir / stored,
            repo_root / stored,
        ])
    file: Path | None = None
    for c in candidates:
        if c.is_file():
            file = c
            break
    if file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "VIDEO_NOT_FOUND", "message": f"Output file for job '{job_id}' was not found on disk"},
        )
    if file.suffix.lower() != ".mp4":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "VIDEO_NOT_FOUND", "message": "Only .mp4 outputs can be streamed"},
        )
    # OpenCV writes mp4v (FMP4), which browsers can't decode. If the output
    # is still in that codec (e.g. the H.264 replace was blocked because the
    # file was locked), prefer a playable sibling left by the transcoder:
    # <stem>_h264.mp4, then <stem>.h264.tmp.mp4.
    file = _prefer_playable_sibling(file)
    return FileResponse(
        path=str(file),
        media_type="video/mp4",
        filename=file.name,
        content_disposition_type="attachment" if download else "inline",
    )


def _prefer_playable_sibling(file: Path) -> Path:
    """Return a browser-playable sibling of an mp4v output if one exists."""
    try:
        import cv2

        cap = cv2.VideoCapture(str(file))
        fourcc = int(cap.get(cv2.CAP_PROP_FOURCC)).to_bytes(4, "little")
        cap.release()
        if fourcc not in (b"FMP4", b"mp4v", b"MP4V"):
            return file
    except Exception:
        return file
    for sibling in (
        file.with_name(f"{file.stem}_h264.mp4"),
        file.with_name(f"{file.stem}.h264.tmp.mp4"),
    ):
        if sibling.is_file() and sibling.stat().st_size > 0:
            logger.info("Serving playable sibling %s for locked mp4v output %s", sibling.name, file.name)
            return sibling
    return file


@router.get(
    "/videos/{filename}",
    summary="Stream a finished pipeline output by filename (durable video URL)",
)
def get_output_video(filename: str) -> FileResponse:
    """Stream an annotated output video by filename.

    Unlike /{job_id}/video (which needs the in-memory job registry), this
    URL keeps working after restarts — emergency cards use it via the
    ``output_video`` stamped into incident metadata.
    """
    import re

    name = Path(filename).name
    if not re.fullmatch(r"[A-Za-z0-9._-]+\.mp4", name, flags=re.IGNORECASE):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "VIDEO_NOT_FOUND", "message": "Unknown output video"},
        )
    backend_dir = Path(__file__).resolve().parents[2]  # backend/
    for base in (Path.cwd(), backend_dir, backend_dir.parent):
        candidate = base / "data" / "videos" / "outputs" / name
        if candidate.is_file():
            return FileResponse(
                path=str(_prefer_playable_sibling(candidate)),
                media_type="video/mp4",
                filename=name,
                content_disposition_type="inline",
            )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error": "VIDEO_NOT_FOUND", "message": f"Output video '{name}' was not found"},
    )


@router.get(
    "/{job_id}/incidents",
    response_model=List[IncidentSummary],
    summary="List incidents produced by a processing job",
)
def get_job_incidents(job_id: str, db: Session = Depends(get_db)) -> List[IncidentSummary]:
    """Return live actionables for a job — CONFIRMED / DISPATCHED only.

    FALSE_ALARM and still-unconfirmed candidates never flag a video:
    0 confirmed means an empty list.
    """
    job = _get_job(job_id)
    ids = list(getattr(job, "incident_ids", []) or [])
    if not ids:
        return []
    rows = db.query(IncidentRow).filter(
        IncidentRow.incident_id.in_(ids),
        IncidentRow.status.in_(["CONFIRMED", "DISPATCHED"]),
    ).all()
    by_id = {r.incident_id: r for r in rows}
    return [_to_summary(by_id[i]) for i in ids if i in by_id]


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
