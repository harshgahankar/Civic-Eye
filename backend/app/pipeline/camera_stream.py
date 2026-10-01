"""
app/pipeline/camera_stream.py

Live camera stream processing (e.g. laptop webcam).

Unlike PipelineManager (finite video file → annotated output file), this
runs an endless capture loop in a background thread:

    cv2.VideoCapture(source) → InferenceEngine → FrameProcessor
        → BehaviorEngine → IncidentEngine
        → annotated JPEG snapshot (MJPEG preview) + event-bus publishing
        + SQLite persistence (best-effort, confirmed incidents only surface
          in the UI; unconfirmed candidates are finalized on stop so a
          stopped stream never leaves "under review" flags behind)

Frame policy: analyze the LATEST frame at most LIVE_FPS times per second
and drop everything in between — the preview never falls behind, detections
just refresh a few times per second (~0.2–0.5 s lag on CPU).

Sources: integer webcam index (0 = default laptop camera), RTSP/HTTP URL,
or a video file path (handy for testing without hardware).
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

import cv2
import numpy as np

from app.ai.inference import InferenceEngine
from app.behavior.behavior_engine import BehaviorEngine
from app.core.config import settings
from app.core.logging import get_logger
from app.events import event_types, get_default_bus
from app.events.publisher import (
    publish_behavior_event,
    publish_incident_detail,
)
from app.intelligence.incident_engine import IncidentEngine
from app.intelligence.persistence import upsert_incident
from app.pipeline.frame_processor import FrameProcessor
from app.pipeline.pipeline_manager import _draw_annotations
from app.schemas.incident import IncidentDetail

logger = get_logger(__name__)


class CameraStreamError(RuntimeError):
    """Raised for stream lifecycle errors (already running, bad source…)."""


@dataclass
class CameraStreamStatus:
    running: bool = False
    camera_id: str = ""
    source: Any = 0
    width: int = 0
    height: int = 0
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    frames_processed: int = 0
    detections_count: int = 0
    behavior_events_count: int = 0
    confirmed_incidents_count: int = 0
    false_alarm_count: int = 0
    average_fps: float = 0.0
    last_error: Optional[str] = None
    confirmed_ids: List[str] = field(default_factory=list)


def _resolve_source(source: Any) -> Any:
    """Accept int index, numeric string, or URL/path string."""
    if isinstance(source, bool):
        raise CameraStreamError("Invalid camera source.")
    if isinstance(source, int):
        if source < 0:
            raise CameraStreamError(f"Invalid camera index: {source}")
        return source
    if isinstance(source, str):
        text = source.strip()
        if not text:
            raise CameraStreamError("Camera source must not be empty.")
        return int(text) if text.isdigit() else text
    raise CameraStreamError(f"Unsupported camera source: {source!r}")


class CameraStreamManager:
    """
    Single live stream (one manager instance serves the whole backend;
    use module-level get_camera_stream()).

    Parameters
    ----------
    engine_factory : callable or None
        Builds the InferenceEngine on start. Overridable in tests to avoid
        loading YOLO (pass a stub with process_frame(frame) -> []).
    """

    def __init__(
        self,
        engine_factory: Optional[Callable[[], Any]] = None,
    ) -> None:
        self._engine_factory = engine_factory or (lambda: InferenceEngine())
        self._lock = threading.Lock()
        self._frame_lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._status = CameraStreamStatus()
        self._latest_jpeg: Optional[bytes] = None
        self._confirmed_ids: List[str] = []

    # ── Public API ────────────────────────────────────────────────────

    def start(
        self,
        camera_id: str = "CAM-LIVE",
        source: Any = 0,
        fps: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Open the source and start the background worker."""
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                raise CameraStreamError(
                    f"Stream already running for '{self._status.camera_id}'. "
                    "Stop it before starting a new one."
                )
            resolved = _resolve_source(source)
            cap = cv2.VideoCapture(resolved)
            if not cap.isOpened():
                cap.release()
                raise CameraStreamError(
                    f"Could not open camera source {resolved!r}. "
                    "For a laptop webcam use 0 (or 1 for an external camera); "
                    "close other apps holding the camera and retry."
                )
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
            cap.release()

            live_fps = fps or settings.LIVE_CAMERA_FPS
            live_fps = max(1.0, min(float(live_fps), 30.0))

            self._status = CameraStreamStatus(
                running=True,
                camera_id=camera_id,
                source=resolved,
                width=width,
                height=height,
                started_at=datetime.now(timezone.utc),
            )
            self._confirmed_ids = []
            self._latest_jpeg = None
            self._stop_event.clear()
            self._thread = threading.Thread(
                target=self._worker,
                args=(camera_id, resolved, live_fps, width, height),
                name=f"camera-stream-{camera_id}",
                daemon=True,
            )
            self._thread.start()
            logger.info(
                "Live stream started: camera=%s source=%r %dx%d @ %.1f fps",
                camera_id, resolved, width, height, live_fps,
            )
            return self.get_status()

    def stop(self) -> Dict[str, Any]:
        """Signal the worker to stop and wait for it (finalizes incidents)."""
        with self._lock:
            thread = self._thread
            if thread is None or not thread.is_alive():
                self._status.running = False
                return self.get_status()
        self._stop_event.set()
        thread.join(timeout=15.0)
        with self._lock:
            self._thread = None
            self._status.running = False
            self._status.stopped_at = datetime.now(timezone.utc)
            return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        s = self._status
        return {
            "running": s.running,
            "camera_id": s.camera_id,
            "source": s.source,
            "width": s.width,
            "height": s.height,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "stopped_at": s.stopped_at.isoformat() if s.stopped_at else None,
            "frames_processed": s.frames_processed,
            "detections_count": s.detections_count,
            "behavior_events_count": s.behavior_events_count,
            "confirmed_incidents_count": s.confirmed_incidents_count,
            "false_alarm_count": s.false_alarm_count,
            "average_fps": round(s.average_fps, 2),
            "last_error": s.last_error,
            "confirmed_ids": list(self._confirmed_ids),
        }

    def get_snapshot(self) -> Optional[bytes]:
        """Latest annotated JPEG frame, or None if not yet available."""
        with self._frame_lock:
            return self._latest_jpeg

    # ── Worker ────────────────────────────────────────────────────────

    def _worker(
        self, camera_id: str, source: Any, live_fps: float,
        width: int, height: int,
    ) -> None:
        min_interval = 1.0 / max(live_fps, 0.1)
        try:
            engine = self._engine_factory()
        except Exception as exc:
            logger.exception("Live stream [%s] engine init failed", camera_id)
            self._fail(str(exc))
            return

        processor = FrameProcessor(engine)
        behavior = BehaviorEngine(camera_id, width, height)
        incidents = IncidentEngine(camera_id=camera_id)
        bus = get_default_bus()

        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            self._fail(f"Could not open camera source {source!r}.")
            return

        t0 = time.perf_counter()
        timestamp = 0.0
        last_run = 0.0
        last_read = 0.0
        fps_ema = 0.0
        consecutive_misses = 0
        frame_idx = 0
        ended = False
        # A video file used as a source must play in real time like a
        # camera; otherwise the loop burns through it instantly and the
        # analysis throttle sees only a handful of frames. Webcams are
        # already live, so they are consumed as fast as possible (keeps
        # the capture buffer empty = lowest latency).
        paced = isinstance(source, str) and os.path.exists(source)

        try:
            while not self._stop_event.is_set():
                if paced:
                    gap = time.perf_counter() - last_read
                    if gap < min_interval:
                        time.sleep(min_interval - gap)
                    last_read = time.perf_counter()
                ok, frame = cap.read()
                if not ok or frame is None:
                    consecutive_misses += 1
                    if consecutive_misses > 90:
                        # File sources end; webcams rarely miss this often.
                        ended = True
                        break
                    time.sleep(0.05)
                    continue
                consecutive_misses = 0

                now = time.perf_counter()
                if now - last_run < min_interval:
                    continue  # drop stale frames — stay live, never queue
                last_run = now
                timestamp = now - t0

                loop_start = time.perf_counter()
                try:
                    events = processor.process_frame(
                        frame, camera_id, frame_idx, timestamp)
                    bevs = behavior.process_frame(events, timestamp)
                    for bev in bevs:
                        publish_behavior_event(bus, bev)
                    changed: List[IncidentDetail] = []
                    changed += incidents.process_detections(events)
                    changed += incidents.process_behavior_events(bevs)
                    for inc in changed:
                        self._publish_incident(bus, inc)
                        try:
                            upsert_incident(
                                inc, incidents.get_history(inc.incident_id))
                        except Exception:
                            pass  # persistence is best-effort
                        if inc.status == "CONFIRMED" \
                                and inc.incident_id not in self._confirmed_ids:
                            self._confirmed_ids.append(inc.incident_id)

                    annotated = _draw_annotations(frame, events)
                    ok_enc, buf = cv2.imencode(
                        ".jpg", annotated,
                        [int(cv2.IMWRITE_JPEG_QUALITY),
                         settings.LIVE_JPEG_QUALITY])
                    if ok_enc:
                        with self._frame_lock:
                            self._latest_jpeg = bytes(buf)

                    with self._lock:
                        st = self._status
                        st.frames_processed = frame_idx + 1
                        st.detections_count += len(events)
                        st.behavior_events_count += len(bevs)
                        st.confirmed_incidents_count = len(self._confirmed_ids)
                        loop_dt = time.perf_counter() - loop_start
                        if loop_dt > 0:
                            inst = 1.0 / loop_dt
                            fps_ema = inst if fps_ema == 0 else \
                                0.9 * fps_ema + 0.1 * inst
                            st.average_fps = fps_ema
                    frame_idx += 1
                except Exception:
                    logger.exception(
                        "Live stream [%s] frame %d failed", camera_id, frame_idx)
        finally:
            try:
                # Close out dangling candidates so a stopped stream leaves
                # no "under review" flags behind.
                tail = incidents.sweep(timestamp)
                tail += incidents.finalize(timestamp)
                for inc in tail:
                    self._publish_incident(bus, inc)
                    try:
                        upsert_incident(
                            inc, incidents.get_history(inc.incident_id))
                    except Exception:
                        pass
                with self._lock:
                    self._status.false_alarm_count = incidents.false_alarm_count
            except Exception:
                logger.exception(
                    "Live stream [%s] shutdown finalize failed", camera_id)
            cap.release()
            with self._lock:
                self._status.running = False
                if ended:
                    self._status.stopped_at = datetime.now(timezone.utc)
            logger.info(
                "Live stream stopped: camera=%s frames=%d confirmed=%d%s",
                camera_id, frame_idx, len(self._confirmed_ids),
                " (source ended)" if ended else "")

    # ── Helpers ───────────────────────────────────────────────────────

    def _fail(self, message: str) -> None:
        with self._lock:
            self._status.running = False
            self._status.last_error = message
            self._status.stopped_at = datetime.now(timezone.utc)

    @staticmethod
    def _publish_incident(bus: Any, inc: IncidentDetail) -> None:
        if inc.status == "CONFIRMED":
            publish_incident_detail(
                bus, event_types.INCIDENT_CREATED, inc)
            publish_incident_detail(
                bus, event_types.INCIDENT_CONFIRMED, inc)
        elif inc.status == "FALSE_ALARM":
            publish_incident_detail(
                bus, event_types.INCIDENT_FALSE_ALARM, inc)


_stream: Optional[CameraStreamManager] = None
_stream_lock = threading.Lock()


def get_camera_stream() -> CameraStreamManager:
    """Process-wide singleton (safe for uvicorn workers: one per process)."""
    global _stream
    with _stream_lock:
        if _stream is None:
            _stream = CameraStreamManager()
        return _stream
