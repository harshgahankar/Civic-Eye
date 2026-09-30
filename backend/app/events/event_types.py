"""
app/events/event_types.py

Typed real-time event types + priorities.

HIGH:   incident confirmations, dispatches, merges, camera offline
MEDIUM: incident updates, behavior signals
LOW:    routine summaries / heartbeats
"""
from __future__ import annotations

# ── Incident lifecycle ────────────────────────────────────────────────────────
INCIDENT_CREATED = "INCIDENT_CREATED"
INCIDENT_UPDATED = "INCIDENT_UPDATED"
INCIDENT_CONFIRMED = "INCIDENT_CONFIRMED"
INCIDENT_DISPATCHED = "INCIDENT_DISPATCHED"
INCIDENT_RESOLVED = "INCIDENT_RESOLVED"
INCIDENT_FALSE_ALARM = "INCIDENT_FALSE_ALARM"
INCIDENT_MERGED = "INCIDENT_MERGED"

# ── Behavior ──────────────────────────────────────────────────────────────────
BEHAVIOR_EVENT_CREATED = "BEHAVIOR_EVENT_CREATED"
DETECTION_CREATED = "DETECTION_CREATED"  # reserved; not published (volume)

# ── Camera ────────────────────────────────────────────────────────────────────
CAMERA_ONLINE = "CAMERA_ONLINE"
CAMERA_OFFLINE = "CAMERA_OFFLINE"
CAMERA_HEALTH_CHANGED = "CAMERA_HEALTH_CHANGED"

# ── System ────────────────────────────────────────────────────────────────────
SYSTEM_STATUS_CHANGED = "SYSTEM_STATUS_CHANGED"
HEARTBEAT = "HEARTBEAT"
PONG = "PONG"

ALL_EVENT_TYPES: frozenset[str] = frozenset({
    INCIDENT_CREATED, INCIDENT_UPDATED, INCIDENT_CONFIRMED,
    INCIDENT_DISPATCHED, INCIDENT_RESOLVED, INCIDENT_FALSE_ALARM,
    INCIDENT_MERGED, BEHAVIOR_EVENT_CREATED, DETECTION_CREATED,
    CAMERA_ONLINE, CAMERA_OFFLINE, CAMERA_HEALTH_CHANGED,
    SYSTEM_STATUS_CHANGED, HEARTBEAT, PONG,
})

PRIORITY: dict[str, str] = {
    INCIDENT_CONFIRMED: "HIGH",
    INCIDENT_DISPATCHED: "HIGH",
    INCIDENT_MERGED: "HIGH",
    CAMERA_OFFLINE: "HIGH",
    INCIDENT_CREATED: "MEDIUM",
    INCIDENT_UPDATED: "MEDIUM",
    INCIDENT_RESOLVED: "MEDIUM",
    INCIDENT_FALSE_ALARM: "MEDIUM",
    BEHAVIOR_EVENT_CREATED: "MEDIUM",
    CAMERA_ONLINE: "MEDIUM",
    CAMERA_HEALTH_CHANGED: "MEDIUM",
    SYSTEM_STATUS_CHANGED: "MEDIUM",
    DETECTION_CREATED: "LOW",
    HEARTBEAT: "LOW",
    PONG: "LOW",
}


def priority_of(event_type: str) -> str:
    return PRIORITY.get(event_type, "LOW")


def is_known(event_type: str) -> bool:
    return event_type in ALL_EVENT_TYPES
