"""
app/events/event_bus.py

In-process asyncio-compatible event bus.

    Producer → EventBus → Subscribers

- Thread-safe ``publish()`` (video pipeline runs in worker threads).
- One failing subscriber never crashes the bus or other subscribers.
- Bounded in-memory history (``MAX_EVENT_HISTORY``) — no unbounded growth.
- Swap for Redis/Kafka later behind this same interface.
"""
from __future__ import annotations

import threading
import time
import uuid
from collections import deque
from typing import Any, Callable

from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import get_logger
from app.events import event_types

logger = get_logger(__name__)

SCHEMA_VERSION = "v1"


class EventEnvelope(BaseModel):
    """Common envelope for every real-time event (UTC timestamps)."""

    event_id: str = Field(
        default_factory=lambda: f"EVT-{uuid.uuid4().hex[:8].upper()}")
    event_type: str
    timestamp: float = Field(default_factory=lambda: time.time())
    source: str = "system"
    camera_id: str | None = None
    incident_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: str = "LOW"
    schema_version: str = SCHEMA_VERSION

    model_config = {"json_schema_extra": {
        "example": {
            "event_id": "EVT-000001",
            "event_type": "INCIDENT_CREATED",
            "timestamp": 1727680000.42,
            "source": "incident_engine",
            "camera_id": "CAM-02",
            "incident_id": "INC-000123",
            "payload": {},
        }
    }}


Subscriber = Callable[[EventEnvelope], None]


class EventBus:
    """Synchronous, thread-safe, in-process event bus."""

    def __init__(self, max_history: int | None = None) -> None:
        self._max_history = max_history or settings.MAX_EVENT_HISTORY
        self._subscribers: list[Subscriber] = []
        self._history: deque[EventEnvelope] = deque(maxlen=self._max_history)
        self._lock = threading.Lock()
        self._published = 0

    # ── Publish / subscribe ───────────────────────────────────────────────

    def publish(
        self,
        event_type: str,
        payload: dict[str, Any] | None = None,
        *,
        source: str = "system",
        camera_id: str | None = None,
        incident_id: str | None = None,
        timestamp: float | None = None,
    ) -> EventEnvelope:
        """Build an envelope, append to bounded history, notify subscribers."""
        if not event_types.is_known(event_type):
            raise ValueError(f"Unknown event type: {event_type!r}")
        envelope = EventEnvelope(
            event_type=event_type,
            timestamp=timestamp if timestamp is not None else time.time(),
            source=source,
            camera_id=camera_id,
            incident_id=incident_id,
            payload=dict(payload or {}),
            priority=event_types.priority_of(event_type),
        )
        with self._lock:
            self._history.append(envelope)
            subscribers = list(self._subscribers)
            self._published += 1
        for callback in subscribers:
            try:
                callback(envelope)
            except Exception:
                logger.exception(
                    {"event": "event_bus_publish",
                     "subscriber": getattr(callback, "__name__", "?"),
                     "event_type": event_type})
        return envelope

    def subscribe(self, callback: Subscriber) -> Subscriber:
        with self._lock:
            self._subscribers.append(callback)
        return callback

    def unsubscribe(self, callback: Subscriber) -> None:
        with self._lock:
            self._subscribers = [s for s in self._subscribers if s != callback]

    # ── Introspection ─────────────────────────────────────────────────────

    def recent(
        self,
        limit: int = 50,
        event_type: str | None = None,
        camera_id: str | None = None,
    ) -> list[EventEnvelope]:
        with self._lock:
            items = list(self._history)
        if event_type:
            items = [e for e in items if e.event_type == event_type]
        if camera_id:
            items = [e for e in items if e.camera_id == camera_id]
        return items[-limit:]

    @property
    def history_size(self) -> int:
        with self._lock:
            return len(self._history)

    @property
    def published_count(self) -> int:
        with self._lock:
            return self._published

    def reset(self) -> None:
        with self._lock:
            self._history.clear()
            self._published = 0


# ── Process-wide default bus (used by pipeline + APIs) ────────────────────────

_default_bus: EventBus | None = None
_bus_lock = threading.Lock()


def get_default_bus() -> EventBus:
    global _default_bus
    with _bus_lock:
        if _default_bus is None:
            _default_bus = EventBus()
        return _default_bus
