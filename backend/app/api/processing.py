"""
app/api/processing.py

Video processing API endpoints.

POST /api/v1/processing/video    — start a processing job (non-blocking)
POST /api/v1/processing/upload   — upload a video file + start a job
GET  /api/v1/processing/{job_id} — query job status
GET  /api/v1/processing/{job_id}/explanation — why flagged / why not

Jobs run in dedicated daemon worker threads so the HTTP response returns
immediately and the event loop stays free for polling/preview requests
while the CPU-bound YOLO pipeline grinds through frames.
"""

from __future__ import annotations

import json
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.incidents import IncidentSummary, _to_summary
from app.core.logging import get_logger
from app.db.database import get_db
from app.db.models import Incident as IncidentRow
from app.schemas.tracking import JobStatus, StartJobRequest, StartJobResponse

logger = get_logger(__name__)
router = APIRouter(prefix="/processing", tags=["processing"])

# ── Upload guardrails ─────────────────────────────────────────────────────
# Keeps the demo box safe: extension whitelist + size cap so a 2 GB upload
# can't fill the disk (outputs/ already holds 144 MB+ samples).
_MAX_UPLOAD_BYTES = 200 * 1024 * 1024
_ALLOWED_VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv"}
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")

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

    result = None
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
            # One entry per incident: the engine emits the same incident on
            # every status change (VERIFYING -> CONFIRMED), so dedupe here or
            # the UI lists "2 confirmed (INC-X, INC-X)".
            job.incident_ids = list(dict.fromkeys(
                i.incident_id for i in result.all_incidents))
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

    # Flag popups for file jobs fire here — after COMPLETED — never mid-video.
    if job.status == "COMPLETED" and result is not None:
        _broadcast_upload_completion(job, result.all_incidents)


def _broadcast_upload_completion(job: JobStatus, all_incidents: list) -> None:
    """Publish UPLOAD_JOB_COMPLETED with the confirmed flag payloads.

    Mid-video INCIDENT_CONFIRMED envelopes from file jobs carry
    ``origin: upload`` so dashboards hold their popups; this completion
    broadcast is what actually raises them. No confirmed incidents →
    no broadcast (clean videos stay silent; the verdict panel explains).
    """
    try:
        from app.events import event_types, get_default_bus

        seen: dict[str, Any] = {}
        for inc in all_incidents or []:
            if getattr(inc, "status", None) in ("CONFIRMED", "DISPATCHED"):
                seen[getattr(inc, "incident_id")] = inc
        if not seen:
            return
        bus = get_default_bus()
        bus.publish(
            event_types.UPLOAD_JOB_COMPLETED,
            {"job_id": job.job_id,
             "confirmed_count": len(seen),
             "incidents": [
                 {"incident_id": inc.incident_id,
                  "incident_type": inc.incident_type,
                  "severity": inc.severity,
                  "confidence": inc.confidence}
                 for inc in seen.values()
             ]},
            source="processing",
            camera_id=job.camera_id,
        )
        logger.info("Job [%s] completion broadcast: %d confirmed",
                    job.job_id, len(seen))
    except Exception:
        logger.exception("Job [%s] completion broadcast failed", job.job_id)


def _launch_pipeline(job: JobStatus, output_path: str) -> None:
    """Start the CPU-bound pipeline on a dedicated daemon worker thread.

    Never run this on the event loop (directly or as a BackgroundTask):
    minutes of YOLO inference would starve polling/preview/upload requests
    and the UI would hang on "STARTING…" forever.
    """
    worker = threading.Thread(
        target=_run_pipeline,
        args=(job, output_path),
        name=f"pipeline-{job.job_id}",
        daemon=True,
    )
    worker.start()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/video",
    response_model=StartJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start a video processing job",
)
def start_video_job(
    payload: StartJobRequest,
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

    # Worker thread — does NOT block the HTTP response
    _launch_pipeline(job, output_path)

    return StartJobResponse(
        status="started",
        camera_id=payload.camera_id,
        source=payload.video_path,
        job_id=job_id,
    )


@router.post(
    "/upload",
    response_model=StartJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a video file and start a processing job",
)
async def upload_video_job(
    file: UploadFile = File(..., description="Video file (.mp4/.avi/.mov/.mkv)"),
    camera_id: str = Form(default="CAM-UPLOAD", max_length=64),
) -> StartJobResponse:
    """Accept a real file upload (judge-friendly) and queue a job.

    Saves to data/videos/uploads/<safe-name>, then runs the same background
    pipeline as POST /video. Extension + 200 MB size guardrails apply.
    """
    raw_name = Path(file.filename or "upload.mp4").name
    safe = _SAFE_NAME.sub("_", raw_name).strip("._") or "upload.mp4"
    ext = Path(safe).suffix.lower()
    if ext not in _ALLOWED_VIDEO_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "UNSUPPORTED_VIDEO",
                    "message": f"Extension '{ext}' not allowed "
                               f"(use {sorted(_ALLOWED_VIDEO_EXTS)})"},
        )
    upload_dir = Path("data") / "videos" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / f"{uuid.uuid4().hex[:8]}_{safe}"

    size = 0
    try:
        with open(dest, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > _MAX_UPLOAD_BYTES:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail={"error": "FILE_TOO_LARGE",
                                "message": "Video exceeds the 200 MB upload cap"},
                    )
                out.write(chunk)
    finally:
        await file.close()
    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "EMPTY_FILE",
                    "message": "Uploaded file is empty"},
        )

    cam = (camera_id or "CAM-UPLOAD").strip() or "CAM-UPLOAD"
    stem = Path(safe).stem
    out_dir = Path("data") / "videos" / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(out_dir / f"{stem}_tracked.mp4")

    job_id = f"JOB-{uuid.uuid4().hex[:8].upper()}"
    job = JobStatus(
        job_id=job_id,
        camera_id=cam,
        status="QUEUED",
        source=str(dest),
        output_path=output_path,
    )
    _update_job(job)
    logger.info("Job [%s] queued from upload: %s (%d bytes)", job_id, dest, size)
    _launch_pipeline(job, output_path)

    return StartJobResponse(
        status="started",
        camera_id=cam,
        source=str(dest),
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
    if job.status != "COMPLETED":
        detail = (
            f"Job '{job_id}' is {job.status} — preview is available only after COMPLETED."
            if job.status in ("QUEUED", "RUNNING")
            else f"Job '{job_id}' did not complete successfully (status={job.status})."
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "VIDEO_NOT_READY", "message": detail},
        )
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
            detail={"error": "VIDEO_NOT_FOUND", "message": f"Output file for job '{job_id}' was not found on disk (backend may have restarted — use /processing/videos/{{filename}} instead)"},
        )
    try:
        if file.stat().st_size == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "VIDEO_NOT_READY", "message": f"Output file for job '{job_id}' is still being written. Wait a few seconds and retry preview."},
            )
    except HTTPException:
        raise
    except Exception:
        pass
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
def get_output_video(filename: str, download: bool = Query(default=False, description="Set Content-Disposition to attachment")) -> FileResponse:
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
                content_disposition_type="attachment" if download else "inline",
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
    ids = list(dict.fromkeys(getattr(job, "incident_ids", []) or []))
    if not ids:
        return []
    rows = db.query(IncidentRow).filter(
        IncidentRow.incident_id.in_(ids),
        IncidentRow.status.in_(["CONFIRMED", "DISPATCHED"]),
    ).all()
    by_id = {r.incident_id: r for r in rows}
    return [_to_summary(by_id[i]) for i in ids if i in by_id]


@router.get(
    "/{job_id}/explanation",
    summary="Explain why a job flagged (or didn't flag) incidents",
)
def get_job_explanation(job_id: str, db: Session = Depends(get_db)) -> dict:
    """Judge-friendly verdict: per-candidate evidence breakdown.

    Returns CONFIRMED actionables plus rejected (FALSE_ALARM/VERIFYING)
    candidates with their signal counts, span, peak overlap/jolt and
    reasons — so the UI can show "why not flagged" instead of silence.
    """
    job = _get_job(job_id)
    ids = list(dict.fromkeys(getattr(job, "incident_ids", []) or []))
    rows = []
    if ids:
        rows = db.query(IncidentRow).filter(
            IncidentRow.incident_id.in_(ids)).all()
    by_id = {r.incident_id: r for r in rows}

    candidates = []
    for iid in ids:
        r = by_id.get(iid)
        if r is None:
            continue
        try:
            evidence = json.loads(r.evidence_json or "[]")
        except (TypeError, ValueError):
            evidence = []
        try:
            reasons = json.loads(r.reasons_json or "[]")
        except (TypeError, ValueError):
            reasons = []
        types: dict[str, int] = {}
        stamps: list[float] = []
        peak_overlap = 0.0
        peak_jolt = 0.0
        for ev in evidence:
            t = str(ev.get("type", "?"))
            types[t] = types.get(t, 0) + 1
            try:
                stamps.append(float(ev.get("timestamp", 0.0)))
            except (TypeError, ValueError):
                pass
            meta = ev.get("metadata") or {}
            try:
                peak_overlap = max(peak_overlap,
                                   float(meta.get("overlap_score", 0.0)))
            except (TypeError, ValueError):
                pass
            try:
                peak_jolt = max(peak_jolt,
                                float(meta.get("speed_change_score", 0.0)))
            except (TypeError, ValueError):
                pass
        span = (max(stamps) - min(stamps)) if len(stamps) >= 2 else 0.0
        candidates.append({
            "incident_id": r.incident_id,
            "incident_type": r.incident_type,
            "status": r.status,
            "confidence": r.confidence,
            "severity": r.severity,
            "track_ids": json.loads(r.track_ids_json or "[]")
            if r.track_ids_json else [],
            "signal_counts": types,
            "span_seconds": round(span, 2),
            "peak_overlap": round(peak_overlap, 3),
            "peak_jolt": round(peak_jolt, 3),
            "reasons": reasons[:6],
        })

    confirmed = sum(1 for c in candidates if c["status"] in
                    ("CONFIRMED", "DISPATCHED"))
    if job.status != "COMPLETED":
        verdict = f"Job is {job.status} — explanation appears after COMPLETED."
    elif confirmed:
        kinds = sorted({c["incident_type"] for c in candidates
                        if c["status"] in ("CONFIRMED", "DISPATCHED")})
        noun = "incident" if confirmed == 1 else "incidents"
        verdict = (f"{confirmed} {noun} CONFIRMED "
                   f"({', '.join(kinds)}). Video flagged in Emergency.")
    elif not candidates:
        verdict = ("No accident/baggage/crowd signals survived verification — "
                   "clean video, nothing to flag.")
    else:
        top = max(candidates,
                  key=lambda c: sum(c["signal_counts"].values()))
        sigs = ", ".join(f"{k}×{v}"
                         for k, v in top["signal_counts"].items())
        verdict = (
            f"No confirmed incidents. Closest candidate {top['incident_id']} "
            f"({top['incident_type']}, {top['status']}): {sigs}, "
            f"span {top['span_seconds']}s, peak IoU {top['peak_overlap']}, "
            f"jolt {top['peak_jolt']}. Needs repeated overlap + motion "
            f"change (stop/slowdown or jolt + swerve) over ≥1s to confirm."
        )
    return {
        "job_id": job_id,
        "job_status": job.status,
        "frames_processed": job.frames_processed,
        "detections_count": job.detections_count,
        "behavior_events_count": job.behavior_events_count,
        "confirmed_incidents_count": job.confirmed_incidents_count,
        "verdict": verdict,
        "candidates": candidates,
    }


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


# ── Live camera stream (laptop webcam / RTSP) ─────────────────────────────

class StartStreamRequest(BaseModel):
    camera_id: str = Field("CAM-LIVE", min_length=1, max_length=64)
    source: int | str = Field(
        0, description="Webcam index (0 = default laptop camera), "
                       "RTSP/HTTP URL, or video file path (for testing)")
    fps: float | None = Field(
        None, ge=1.0, le=30.0,
        description="Analyzed frames/sec; stale frames are dropped. "
                    "Defaults to LIVE_CAMERA_FPS.")


def _camera_stream():
    from app.pipeline.camera_stream import get_camera_stream
    return get_camera_stream()


@router.post(
    "/camera/start",
    summary="Start live detection on a camera source",
)
def start_camera_stream(payload: StartStreamRequest) -> dict:
    """Open a webcam/RTSP source and run the detection pipeline live."""
    from app.pipeline.camera_stream import CameraStreamError
    try:
        return _camera_stream().start(
            camera_id=payload.camera_id,
            source=payload.source,
            fps=payload.fps,
        )
    except CameraStreamError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT
            if "already running" in str(exc)
            else status.HTTP_400_BAD_REQUEST,
            detail={"error": "CAMERA_STREAM_ERROR", "message": str(exc)},
        )


@router.post(
    "/camera/stop",
    summary="Stop the live camera stream",
)
def stop_camera_stream() -> dict:
    """Stop the worker (unconfirmed candidates close as FALSE_ALARM)."""
    return _camera_stream().stop()


@router.get(
    "/camera/status",
    summary="Live camera stream status + counters",
)
def camera_stream_status() -> dict:
    """Frames/detections/confirmed counts and current fps."""
    return _camera_stream().get_status()


@router.get(
    "/camera/snapshot",
    summary="Latest annotated live frame (JPEG)",
)
def camera_stream_snapshot() -> Response:
    """Single JPEG of the most recent analyzed frame."""
    jpeg = _camera_stream().get_snapshot()
    if jpeg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "NO_FRAME_YET",
                    "message": "Stream has not produced a frame yet"},
        )
    return Response(content=jpeg, media_type="image/jpeg")


@router.get(
    "/camera/stream",
    summary="Live annotated MJPEG preview (open in a browser)",
)
def camera_stream_mjpeg():
    """Multipart MJPEG of annotated frames. View at this URL directly."""
    from fastapi.responses import StreamingResponse

    stream = _camera_stream()

    def _frames():
        import time as _time
        idle = 0
        while True:
            jpeg = stream.get_snapshot()
            if jpeg is None:
                if not stream.get_status()["running"]:
                    break
                idle += 1
                if idle > 150:  # ~30 s with no frames → end
                    break
                _time.sleep(0.2)
                continue
            idle = 0
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                   + jpeg + b"\r\n")
            _time.sleep(0.1)

    return StreamingResponse(
        _frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
