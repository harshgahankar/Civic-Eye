"""
app/events/subscriber.py

Subscriber helpers: filtered dispatch + subscription-filter matching shared
by the WebSocket layer and any future consumers.
"""
from __future__ import annotations

from typing import Any, Callable, Collection

from pydantic import BaseModel

from app.events.event_bus import EventBus, EventEnvelope


class SubscriptionFilter(BaseModel):
    """Client subscription filter. Empty lists mean 'match all'."""

    camera_ids: list[str] = []
    incident_types: list[str] = []
    severities: list[str] = []
    event_types: list[str] = []


def envelope_matches(
    envelope: EventEnvelope,
    camera_ids: Collection[str] = (),
    incident_types: Collection[str] = (),
    severities: Collection[str] = (),
    event_types: Collection[str] = (),
) -> bool:
    """True when the envelope satisfies every non-empty filter dimension."""
    if camera_ids and envelope.camera_id not in camera_ids:
        return False
    if event_types and envelope.event_type not in event_types:
        return False
    payload = envelope.payload or {}
    if incident_types:
        if "incident_type" in payload and \
                payload.get("incident_type") not in incident_types:
            return False
    if severities:
        if "severity" in payload and payload.get("severity") not in severities:
            return False
    return True


class FilteredSubscriber:
    """A bus subscriber that only forwards matching envelopes."""

    def __init__(
        self,
        forward: Callable[[EventEnvelope], None],
        **filters: Any,
    ) -> None:
        self._forward = forward
        self._filters = filters

    def __call__(self, envelope: EventEnvelope) -> None:
        if envelope_matches(envelope, **self._filters):
            self._forward(envelope)

    def attach(self, bus: EventBus) -> "FilteredSubscriber":
        bus.subscribe(self)
        return self

    def detach(self, bus: EventBus) -> None:
        bus.unsubscribe(self)
