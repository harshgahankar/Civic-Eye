"""
app/services/camera_health.py

Lightweight camera/source health tracking.

For video files, "camera health" means pipeline/source health — the service
never pretends a prerecorded file is a live physical camera.

Statuses: ONLINE (frames flowing, fps OK) → DEGRADED (slow/fps low) →
OFFLINE (no frames within CAMERA_OFFLINE_TIMEOUT_SECONDS).

Transitions publish CAMERA_HEALTH_CHANGED / CAMERA_OFFLINE events when a
bus is attached.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

ONLINE = "ONLINE"
DEGRADED = "DEGRADED"
OFFLINE = "OFFLINE"


@dataclass
class CameraHealth:
    camera_id: str
    status: str = "UNKNOWN"
    last_seen_at: float = 0.0
    fps: float = 0.0
    frames_processed: int = 0
    errors: int = 0


class CameraHealthService:
    def __init__(
        self,
        offline_timeout: float | None = None,
        degraded_fps: float | None = None,
        on_change: Callable[[str, str, dict[str, Any]], None] | None = None,
    ) -> None:
        self._offline_timeout = (
            offline_timeout
            if offline_timeout is not None
            else settings.CAMERA_OFFLINE_TIMEOUT_SECONDS)
        self._degraded_fps = (
            degraded_fps
            if degraded_fps is not None
            else settings.CAMERA_DEGRADED_FPS_THRESHOLD)
        self._on_change = on_change
        self._cameras: dict[str, CameraHealth] = {}
        self._lock = threading.Lock()

    def set_listener(
        self, on_change: Callable[[str, str, dict[str, Any]], None] | None
    ) -> None:
        self._on_change = on_change

    def report_frame(
        self,
        camera_id: str,
        fps: float = 0.0,
        frames: int = 1,
        timestamp: float | None = None,
    ) -> CameraHealth:
        """Record processed frames; returns the (possibly transitioned) state."""
        now = timestamp if timestamp is not None else time.time()
        with self._lock:
            health = self._cameras.get(camera_id)
            if health is None:
                health = CameraHealth(camera_id=camera_id)
                self._cameras[camera_id] = health
            health.last_seen_at = now
            health.frames_processed += frames
            if fps > 0:
                health.fps = fps
            new_status = (ONLINE if health.fps >= self._degraded_fps
                          else DEGRADED)
            return self._apply(camera_id, health, new_status)

    def report_error(self, camera_id: str) -> CameraHealth:
        with self._lock:
            health = self._cameras.get(camera_id)
            if health is None:
                health = CameraHealth(camera_id=camera_id)
                self._cameras[camera_id] = health
            health.errors += 1
            return self._apply(camera_id, health, health.status
                               if health.status != "UNKNOWN" else DEGRADED)

    def evaluate(self, camera_id: str,
                 now: float | None = None) -> CameraHealth:
        """Re-evaluate staleness (marks OFFLINE when timed out)."""
        now = now if now is not None else time.time()
        with self._lock:
            health = self._cameras.get(camera_id)
            if health is None:
                health = CameraHealth(camera_id=camera_id, status=OFFLINE)
                self._cameras[camera_id] = health
                return health
            if (health.status != OFFLINE
                    and now - health.last_seen_at > self._offline_timeout):
                return self._apply(camera_id, health, OFFLINE)
            return health

    def evaluate_all(self, now: float | None = None) -> list[CameraHealth]:
        with self._lock:
            ids = list(self._cameras.keys())
        return [self.evaluate(cid, now) for cid in ids]

    def get(self, camera_id: str) -> CameraHealth | None:
        with self._lock:
            return self._cameras.get(camera_id)

    def all(self) -> list[CameraHealth]:
        with self._lock:
            return list(self._cameras.values())

    def reset(self) -> None:
        with self._lock:
            self._cameras.clear()

    # ── internals ─────────────────────────────────────────────────────────

    def _apply(self, camera_id: str, health: CameraHealth,
               new_status: str) -> CameraHealth:
        # Callers hold the lock.
        old_status = health.status
        health.status = new_status
        if old_status != new_status and self._on_change is not None:
            payload = {"old_status": old_status, "new_status": new_status,
                       "fps": health.fps,
                       "frames_processed": health.frames_processed,
                       "errors": health.errors}
            try:
                self._on_change(camera_id, new_status, payload)
            except Exception:
                logger.exception("Camera health listener failed")
            logger.info({"event": "camera_health_changed",
                         "camera_id": camera_id,
                         "old_status": old_status, "new_status": new_status})
        return health


# ── Process-wide singleton (pipeline + APIs share it) ─────────────────────────

_health_service: CameraHealthService | None = None
_health_lock = threading.Lock()


def get_health_service() -> CameraHealthService:
    global _health_service
    with _health_lock:
        if _health_service is None:
            _health_service = CameraHealthService()
        return _health_service
