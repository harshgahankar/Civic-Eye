"""
app/pipeline/pipeline_manager.py

End-to-end video processing pipeline:

  VideoReader → FrameProcessor → (InferenceEngine → ByteTrack)
             ↓
        DetectionEvent list per frame
             ↓
         BehaviorEngine → BehaviorEvent list
              ↓
         IncidentEngine → IncidentDetail list
              ↓
         Annotated video writer + JSONL logs (events, behavior, incidents)
         + SQLite persistence (best-effort)

Annotation overlay format:
    CAR #17
    94%
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np

from app.ai.inference import InferenceEngine
from app.behavior.behavior_engine import BehaviorEngine
from app.core.config import settings
from app.core.logging import get_logger
from app.events import event_types, get_default_bus
from app.events.publisher import (
    publish_behavior_event,
    publish_camera_health,
    publish_incident_detail,
)
from app.intelligence.incident_engine import IncidentEngine
from app.intelligence.multi_camera import get_fusion_engine
from app.intelligence.persistence import save_group, upsert_incident
from app.services.camera_health import get_health_service
from app.pipeline.frame_processor import FrameProcessor
from app.pipeline.video_reader import VideoReader, VideoReaderError
from app.schemas.behavior_event import BehaviorEvent
from app.schemas.detection import DetectionEvent
from app.schemas.incident import IncidentDetail

logger = get_logger(__name__)


def ensure_browser_compatible_mp4(path: str) -> str:
    """Transcode an OpenCV-written MP4 (mp4v/FMP4) to H.264 + faststart.

    Browsers (Chrome/Edge) cannot play the MPEG-4 Part 2 codec that
    cv2.VideoWriter writes with fourcc "mp4v", so the <video> tag shows a
    black box with 0:00. Re-encoding with libx264 + yuv420p fixes inline
    preview and keeps the file downloadable. Returns the path of the
    playable file (normally ``path`` itself).

    If the original file is locked by another process (Windows refuses the
    atomic replace), the playable copy is kept alongside as
    ``<stem>_h264.mp4`` and *that* path is returned so the job still points
    at a previewable video. If ffmpeg is missing the original is kept and a
    warning is logged.
    """
    try:
        import imageio_ffmpeg
        import subprocess

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        tmp = str(Path(path).with_suffix(".h264.tmp.mp4"))
        subprocess.run(
            [
                ffmpeg, "-y", "-v", "error",
                "-i", path,
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-crf", "23", "-preset", "veryfast",
                "-movflags", "+faststart",
                tmp,
            ],
            check=True,
            timeout=600,
        )
        for _ in range(5):
            try:
                os.replace(tmp, path)
                logger.info("Transcoded output to browser-compatible H.264: %s", path)
                return path
            except PermissionError:
                time.sleep(1)
        # Original is locked (e.g. another process holds it open on Windows):
        # keep the playable copy under a fresh name and point the job at it.
        fallback = str(Path(path).with_name(f"{Path(path).stem}_h264.mp4"))
        os.replace(tmp, fallback)
        logger.warning(
            "H.264 replace blocked for %s (file locked) — playable copy kept at %s",
            path, fallback,
        )
        return fallback
    except Exception as exc:  # ffmpeg missing / transcode failed — keep original
        logger.warning("H.264 transcode skipped for %s: %s", path, exc)
    return path

# Annotation colours per class (BGR) — cycles through these
_PALETTE = [
    (0, 255, 0),     # green
    (255, 128, 0),   # blue-orange
    (0, 128, 255),   # orange
    (255, 0, 128),   # pink
    (128, 0, 255),   # purple
    (0, 255, 255),   # yellow
    (255, 255, 0),   # cyan
    (255, 0, 0),     # blue
]


def _colour_for(track_id: int) -> tuple[int, int, int]:
    return _PALETTE[track_id % len(_PALETTE)]


_health_wired = False


def _ensure_health_wiring() -> None:
    """Attach the health service to the event bus exactly once."""
    global _health_wired
    if _health_wired:
        return
    _health_wired = True
    bus = get_default_bus()

    def _on_change(camera_id: str, status: str, payload: dict) -> None:
        publish_camera_health(bus, camera_id, status, payload)

    get_health_service().set_listener(_on_change)


def _draw_annotations(
    frame: np.ndarray,
    events: list[DetectionEvent],
) -> np.ndarray:
    """Draw bounding boxes, class names, track IDs, and confidence on frame."""
    annotated = frame.copy()
    for ev in events:
        colour = _colour_for(ev.track_id)
        x1, y1, x2, y2 = (
            int(ev.bbox.x1), int(ev.bbox.y1),
            int(ev.bbox.x2), int(ev.bbox.y2),
        )
        # Bounding box
        cv2.rectangle(annotated, (x1, y1), (x2, y2), colour, 2)

        # Label: "BAG\n94%" (track IDs are internal-only, not shown)
        label_top = f"{ev.class_name.upper()}"
        label_bot = f"{ev.confidence * 100:.0f}%"

        font = cv2.FONT_HERSHEY_SIMPLEX
        scale, thickness = 0.55, 1

        (tw, th), baseline = cv2.getTextSize(label_top, font, scale, thickness)
        lx = max(x1, 0)
        ly = max(y1 - th - baseline - 6, 0)

        # Background rectangle for label
        cv2.rectangle(
            annotated,
            (lx, ly),
            (lx + tw + 4, ly + th + baseline + 8),
            colour,
            cv2.FILLED,
        )
        # Label text (dark for contrast)
        text_colour = (0, 0, 0) if sum(colour) > 380 else (255, 255, 255)
        cv2.putText(
            annotated, label_top,
            (lx + 2, ly + th + 2),
            font, scale, text_colour, thickness, cv2.LINE_AA,
        )
        cv2.putText(
            annotated, label_bot,
            (lx + 2, ly + th + baseline + 6),
            font, scale * 0.85, text_colour, thickness, cv2.LINE_AA,
        )
    return annotated


@dataclass
class PipelineResult:
    job_id: str
    camera_id: str
    status: str                         # COMPLETED | FAILED
    source: str
    output_path: Optional[str] = None
    events_path: Optional[str] = None
    behavior_events_path: Optional[str] = None
    incidents_path: Optional[str] = None
    frames_processed: int = 0
    detections_count: int = 0
    behavior_events_count: int = 0
    incidents_count: int = 0
    confirmed_incidents_count: int = 0
    false_alarm_count: int = 0
    average_fps: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    all_events: list[DetectionEvent] = field(default_factory=list)
    all_behavior_events: list[BehaviorEvent] = field(default_factory=list)
    all_incidents: list[IncidentDetail] = field(default_factory=list)


class PipelineManager:
    """
    Processes a video file end-to-end.

    One PipelineManager instance is typically created per job.
    """

    def __init__(
        self,
        engine: Optional[InferenceEngine] = None,
        progress_callback: Optional[Callable[[int, int, float, int], None]] = None,
    ) -> None:
        """
        Parameters
        ----------
        engine : InferenceEngine or None
            If None, one is created using config defaults.
        progress_callback : callable or None
            Called periodically as: callback(frame_number, detections, fps, tracks)
        """
        self._engine = engine or InferenceEngine()
        self._processor = FrameProcessor(self._engine)
        self._progress_callback = progress_callback

    def process_video(
        self,
        video_path: str,
        camera_id: str,
        output_path: Optional[str] = None,
        job_id: str = "JOB-000",
    ) -> PipelineResult:
        """
        Process a video file: detect, track, analyze behavior, annotate, write output.

        Parameters
        ----------
        video_path  : str   Path to input MP4.
        camera_id   : str   Logical camera ID embedded in DetectionEvents.
        output_path : str   Path for annotated output video.
                            Defaults to data/videos/outputs/<stem>_tracked.mp4.
        job_id      : str   Job identifier for logging and file naming.

        Returns
        -------
        PipelineResult
        """
        result = PipelineResult(
            job_id=job_id,
            camera_id=camera_id,
            status="FAILED",
            source=video_path,
            started_at=datetime.now(timezone.utc),
        )

        # ── Resolve output paths ──────────────────────────────────────────
        if output_path is None:
            stem = Path(video_path).stem
            out_dir = Path("data") / "videos" / "outputs"
            out_dir.mkdir(parents=True, exist_ok=True)
            output_path = str(out_dir / f"{stem}_tracked.mp4")

        events_dir = Path("data") / "outputs" / job_id
        events_dir.mkdir(parents=True, exist_ok=True)
        events_path = str(events_dir / "events.jsonl")
        behavior_events_path = str(events_dir / "behavior_events.jsonl")
        incidents_path = str(events_dir / "incidents.jsonl")

        result.output_path = output_path
        result.events_path = events_path
        result.behavior_events_path = behavior_events_path
        result.incidents_path = incidents_path

        # ── Open video ────────────────────────────────────────────────────
        try:
            reader = VideoReader(video_path, frame_skip=settings.AI_FRAME_SKIP)
        except VideoReaderError as exc:
            result.error = str(exc)
            result.completed_at = datetime.now(timezone.utc)
            logger.error("Pipeline failed to open video: %s", exc)
            return result

        # ── Create BehaviorEngine + IncidentEngine for this job ─────────────
        behavior_engine = BehaviorEngine(
            camera_id=camera_id,
            frame_width=reader.width,
            frame_height=reader.height,
        )
        incident_engine = IncidentEngine(camera_id=camera_id)

        # ── Source health: ONLINE when frames flow (file = pipeline health) ──
        _ensure_health_wiring()
        health = get_health_service()
        health.report_frame(camera_id, fps=reader.fps, frames=0)

        # ── Set up video writer ───────────────────────────────────────────
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out_fps = min(reader.fps, settings.MAX_FPS)
        writer = cv2.VideoWriter(
            output_path, fourcc, out_fps, (reader.width, reader.height)
        )
        if not writer.isOpened():
            reader.release()
            result.error = f"Could not open VideoWriter for '{output_path}'"
            result.completed_at = datetime.now(timezone.utc)
            logger.error(result.error)
            return result

        logger.info(
            "Pipeline [%s] start: %s  (%dx%d @ %.1f fps, %d frames)",
            job_id, video_path, reader.width, reader.height,
            reader.fps, reader.frame_count,
        )

        # ── Main processing loop ──────────────────────────────────────────
        all_events: list[DetectionEvent] = []
        all_behavior_events: list[BehaviorEvent] = []
        all_incidents: list[IncidentDetail] = []
        t_start = time.perf_counter()
        fps_samples: list[float] = []
        LOG_INTERVAL = 30  # log every N frames

        try:
            with (
                open(events_path, "w", encoding="utf-8") as ev_file,
                open(behavior_events_path, "w", encoding="utf-8") as bev_file,
                open(incidents_path, "w", encoding="utf-8") as inc_file,
            ):
                bus = get_default_bus()
                fusion = get_fusion_engine()
                health = get_health_service()
                seen_incidents: set[str] = set()

                def _publish_incident(inc: IncidentDetail) -> None:
                    """Map an incident change onto bus event types."""
                    iid = inc.incident_id
                    if inc.status == "CONFIRMED":
                        if iid not in seen_incidents:
                            publish_incident_detail(
                                bus, event_types.INCIDENT_CREATED, inc)
                        publish_incident_detail(
                            bus, event_types.INCIDENT_CONFIRMED, inc)
                    elif inc.status == "FALSE_ALARM":
                        publish_incident_detail(
                            bus, event_types.INCIDENT_FALSE_ALARM, inc)
                    elif iid not in seen_incidents:
                        publish_incident_detail(
                            bus, event_types.INCIDENT_CREATED, inc)
                    else:
                        publish_incident_detail(
                            bus, event_types.INCIDENT_UPDATED, inc)
                    seen_incidents.add(iid)

                def _record_incidents(incidents: list[IncidentDetail]) -> None:
                    for inc in incidents:
                        inc_file.write(inc.model_dump_json() + "\n")
                        all_incidents.append(inc)
                        logger.info(
                            "[INCIDENT][%s] %s %s severity=%s confidence=%.2f",
                            camera_id,
                            inc.incident_id,
                            inc.incident_type,
                            inc.severity,
                            inc.confidence,
                        )
                    # Best-effort SQLite persistence (never breaks the pipeline)
                    try:
                        from app.db.database import init_db
                        init_db()
                    except Exception:
                        pass
                    for inc in incidents:
                        upsert_incident(
                            inc, incident_engine.get_history(
                                inc.incident_id))
                        _publish_incident(inc)
                        # Cross-camera fusion for confirmed incidents.
                        if inc.status == "CONFIRMED":
                            group = fusion.process_incident(inc)
                            if group is not None:
                                save_group(group)
                                primary = (fusion.get_incident(
                                    group.primary_incident_id) or inc)
                                upsert_incident(
                                    primary, incident_engine.get_history(
                                        primary.incident_id))
                                bus.publish(
                                    event_types.INCIDENT_MERGED,
                                    {"group_id": group.group_id,
                                     "primary_incident":
                                         group.primary_incident_id,
                                     "members": [
                                         m.model_dump()
                                         for m in group.member_incidents],
                                     "correlation_confidence":
                                         group.member_incidents[-1]
                                         .correlation_score},
                                    source="fusion_engine",
                                    camera_id=inc.camera_id,
                                    incident_id=group.primary_incident_id)

                for frame_idx, frame in reader:
                    t_frame_start = time.perf_counter()
                    timestamp = frame_idx / reader.fps

                    # Detect + track
                    events = self._processor.process_frame(
                        frame, camera_id, frame_idx, timestamp
                    )

                    # ── Behavioral analysis ───────────────────────────────
                    behavior_events = behavior_engine.process_frame(events, timestamp)
                    for bev in behavior_events:
                        bev_file.write(bev.model_dump_json() + "\n")
                        publish_behavior_event(bus, bev)
                        logger.info(
                            "[BEHAVIOR][%s] %s track_ids=%s score=%.2f",
                            camera_id,
                            bev.event_type,
                            bev.track_ids,
                            bev.score,
                        )
                    all_behavior_events.extend(behavior_events)

                    # ── Incident intelligence ─────────────────────────────
                    changed = incident_engine.process_detections(events)
                    changed += incident_engine.process_behavior_events(
                        behavior_events)
                    _record_incidents(changed)

                    # Draw annotations
                    annotated = _draw_annotations(frame, events)
                    writer.write(annotated)

                    # Write JSONL events
                    for ev in events:
                        ev_file.write(ev.model_dump_json() + "\n")
                    all_events.extend(events)

                    # FPS tracking
                    elapsed = time.perf_counter() - t_frame_start
                    if elapsed > 0:
                        fps_samples.append(1.0 / elapsed)

                    # Periodic logging
                    if frame_idx > 0 and frame_idx % LOG_INTERVAL == 0:
                        recent_fps = (
                            sum(fps_samples[-LOG_INTERVAL:]) / min(len(fps_samples), LOG_INTERVAL)
                        )
                        health.report_frame(camera_id, fps=recent_fps,
                                            frames=LOG_INTERVAL)
                        logger.info(
                            "Camera: %s | Frame: %d | FPS: %.1f | "
                            "Detections: %d | Active Tracks: %d | Behavior Events: %d",
                            camera_id, frame_idx, recent_fps,
                            len(events), len(events), len(all_behavior_events),
                        )
                        if self._progress_callback:
                            self._progress_callback(
                                frame_idx, len(all_events), recent_fps, len(events)
                            )

                # ── End of video: nothing unconfirmed survives ──────────────
                # sweep() expires stale candidates; finalize() closes the rest
                # so a clean video ends with 0 live candidates (no "under
                # review" flag when nothing was confirmed).
                if reader.frame_count > 0:
                    final_ts = reader.frame_count / reader.fps
                else:
                    final_ts = (reader.frame_number / reader.fps
                                + settings.INCIDENT_EVIDENCE_WINDOW_SECONDS * 3)
                _record_incidents(incident_engine.sweep(final_ts))
                _record_incidents(incident_engine.finalize(final_ts))

        except Exception as exc:
            logger.exception("Pipeline [%s] error at frame %d", job_id, reader.frame_number)
            result.error = str(exc)
            try:
                health.report_error(camera_id)
            except Exception:
                pass
        finally:
            reader.release()
            writer.release()
            # OpenCV writes mp4v (FMP4) which browsers can't play — transcode
            # to H.264 so the frontend <video> preview works. Uses the
            # returned path: if the original is locked, the playable copy
            # lives at <stem>_h264.mp4 and the job points there instead.
            if result.error is None and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                output_path = ensure_browser_compatible_mp4(output_path)
                result.output_path = output_path
                # Stamp upload provenance onto this job's incidents so the
                # frontend can surface the tracked video on emergency cards
                # and flag accident videos (best-effort; never fails the job).
                try:
                    video_name = Path(output_path).name
                    for inc in all_incidents:
                        inc.metadata.update({
                            "job_id": job_id,
                            "source": "upload",
                            "output_video": video_name,
                        })
                        upsert_incident(
                            inc, incident_engine.get_history(inc.incident_id))
                except Exception as exc:
                    logger.warning("Incident upload-stamp skipped [%s]: %s", job_id, exc)

        # ── Final metrics ─────────────────────────────────────────────────
        total_elapsed = time.perf_counter() - t_start
        avg_fps = (
            sum(fps_samples) / len(fps_samples) if fps_samples else 0.0
        )

        result.frames_processed = reader.frame_number
        result.detections_count = len(all_events)
        result.behavior_events_count = len(all_behavior_events)
        result.incidents_count = len(all_incidents)
        result.confirmed_incidents_count = len({
            inc.incident_id for inc in all_incidents
            if inc.status == "CONFIRMED"})
        result.false_alarm_count = incident_engine.false_alarm_count + sum(
            1 for inc in all_incidents if inc.status == "FALSE_ALARM")
        result.average_fps = round(avg_fps, 2)
        result.completed_at = datetime.now(timezone.utc)
        result.all_events = all_events
        result.all_behavior_events = all_behavior_events
        result.all_incidents = all_incidents

        # Verify output file
        if result.error is None:
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                result.status = "COMPLETED"
                logger.info(
                    "Pipeline [%s] COMPLETED: %d frames, %d detections, "
                    "%d behavior events, %d incidents (%d confirmed), "
                    "%.1f avg fps → %s",
                    job_id, result.frames_processed,
                    result.detections_count, result.behavior_events_count,
                    result.incidents_count, result.confirmed_incidents_count,
                    result.average_fps, output_path,
                )
            else:
                result.status = "FAILED"
                result.error = "Output video was not created or is empty."
                logger.error("Pipeline [%s] output verification failed.", job_id)

        return result
