"""
app/events/publisher.py

Convenience publishers that map domain objects (incidents, behavior events,
camera health) onto EventBus envelopes. Keeps publishing call-sites small
and guarantees consistent payload shapes.
"""
from __future__ import annotations

from typing import Any

from app.events import event_types
from app.events.event_bus import EventBus, EventEnvelope


def publish_incident(
    bus: EventBus,
    event_type: str,
    incident_id: str,
    camera_id: str,
    payload: dict[str, Any] | None = None,
) -> EventEnvelope:
    return bus.publish(
        event_type, payload,
        source="incident_engine",
        camera_id=camera_id,
        incident_id=incident_id,
    )


def publish_incident_detail(
    bus: EventBus, event_type: str, incident,
    extra: dict[str, Any] | None = None,
) -> EventEnvelope:
    """Publish from an IncidentDetail (payload: type/severity/confidence).

    ``extra`` merges additional routing context (e.g. upload job origin)
    without touching the incident itself.
    """
    return publish_incident(
        bus, event_type, incident.incident_id, incident.camera_id,
        {"incident_type": incident.incident_type,
         "severity": incident.severity,
         "confidence": incident.confidence,
         "status": incident.status,
         "track_ids": list(incident.track_ids),
         **(extra or {})},
    )


def publish_behavior_event(bus: EventBus, event) -> EventEnvelope:
    return bus.publish(
        event_types.BEHAVIOR_EVENT_CREATED,
        {"behavior_event_id": event.event_id,
         "behavior_type": event.event_type,
         "score": event.score,
         "track_ids": list(event.track_ids)},
        source="behavior_engine",
        camera_id=event.camera_id,
    )


def publish_camera_health(
    bus: EventBus, camera_id: str, status: str, payload: dict[str, Any]
) -> EventEnvelope:
    event_type = (
        event_types.CAMERA_OFFLINE if status == "OFFLINE"
        else event_types.CAMERA_HEALTH_CHANGED
    )
    return bus.publish(
        event_type, {"status": status, **payload},
        source="camera_health", camera_id=camera_id,
    )
