"""
app/pipeline/pipeline_manager.py

End-to-end video processing pipeline:

  VideoReader → FrameProcessor → (InferenceEngine → ByteTrack)
             ↓
        DetectionEvent list per frame
             ↓
        Annotated video writer  +  JSONL event log

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
from app.core.config import settings
from app.core.logging import get_logger
from app.pipeline.frame_processor import FrameProcessor
from app.pipeline.video_reader import VideoReader, VideoReaderError
from app.schemas.detection import DetectionEvent

logger = get_logger(__name__)

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

        # Label: "CAR #17\n94%"
        label_top = f"{ev.class_name.upper()} #{ev.track_id}"
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
    frames_processed: int = 0
    detections_count: int = 0
    average_fps: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    all_events: list[DetectionEvent] = field(default_factory=list)


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
        Process a video file: detect, track, annotate, and write output.

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

        result.output_path = output_path
        result.events_path = events_path

        # ── Open video ────────────────────────────────────────────────────
        try:
            reader = VideoReader(video_path, frame_skip=settings.AI_FRAME_SKIP)
        except VideoReaderError as exc:
            result.error = str(exc)
            result.completed_at = datetime.now(timezone.utc)
            logger.error("Pipeline failed to open video: %s", exc)
            return result

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
        t_start = time.perf_counter()
        t_log = t_start
        fps_samples: list[float] = []
        LOG_INTERVAL = 30  # log every N frames

        try:
            with open(events_path, "w", encoding="utf-8") as ev_file:
                for frame_idx, frame in reader:
                    t_frame_start = time.perf_counter()
                    timestamp = frame_idx / reader.fps

                    # Detect + track
                    events = self._processor.process_frame(
                        frame, camera_id, frame_idx, timestamp
                    )

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
                    now = time.perf_counter()
                    if frame_idx > 0 and frame_idx % LOG_INTERVAL == 0:
                        recent_fps = (
                            sum(fps_samples[-LOG_INTERVAL:]) / min(len(fps_samples), LOG_INTERVAL)
                        )
                        logger.info(
                            "Camera: %s | Frame: %d | FPS: %.1f | "
                            "Detections: %d | Active Tracks: %d",
                            camera_id, frame_idx, recent_fps,
                            len(events), len(events),
                        )
                        if self._progress_callback:
                            self._progress_callback(
                                frame_idx, len(all_events), recent_fps, len(events)
                            )

        except Exception as exc:
            logger.exception("Pipeline [%s] error at frame %d", job_id, reader.frame_number)
            result.error = str(exc)
        finally:
            reader.release()
            writer.release()

        # ── Final metrics ─────────────────────────────────────────────────
        total_elapsed = time.perf_counter() - t_start
        avg_fps = (
            sum(fps_samples) / len(fps_samples) if fps_samples else 0.0
        )

        result.frames_processed = reader.frame_number
        result.detections_count = len(all_events)
        result.average_fps = round(avg_fps, 2)
        result.completed_at = datetime.now(timezone.utc)
        result.all_events = all_events

        # Verify output file
        if result.error is None:
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                result.status = "COMPLETED"
                logger.info(
                    "Pipeline [%s] COMPLETED: %d frames, %d detections, "
                    "%.1f avg fps → %s",
                    job_id, result.frames_processed,
                    result.detections_count, result.average_fps, output_path,
                )
            else:
                result.status = "FAILED"
                result.error = "Output video was not created or is empty."
                logger.error("Pipeline [%s] output verification failed.", job_id)

        return result
