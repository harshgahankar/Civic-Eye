"""
app/api/dashboard.py

Real-time command-center snapshot + recent-event feed.
Aggregates existing database/services state — no second database.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Incident
from app.events import get_default_bus
from app.services.camera_health import get_health_service

router = APIRouter(tags=["dashboard"])


class DashboardSnapshot(BaseModel):
    active_incidents: int
    critical_incidents: int
    high_incidents: int
    cameras_online: int
    cameras_degraded: int
    cameras_offline: int
    recent_incidents: list[dict] = Field(default_factory=list)
    camera_health: list[dict] = Field(default_factory=list)
    system_timestamp: datetime


@router.get("/dashboard/snapshot", response_model=DashboardSnapshot,
            summary="Real-time command-center snapshot")
def dashboard_snapshot(
    db: Session = Depends(get_db),
) -> DashboardSnapshot:
    active_statuses = ["DETECTED", "VERIFYING", "CONFIRMED", "DISPATCHED"]
    active = db.query(Incident).filter(
        Incident.status.in_(active_statuses)).all()
    critical = sum(1 for i in active if (i.severity or "").upper() == "CRITICAL")
    high = sum(1 for i in active if (i.severity or "").upper() == "HIGH")

    health = get_health_service()
    states = health.evaluate_all()
    online = sum(1 for h in states if h.status == "ONLINE")
    degraded = sum(1 for h in states if h.status == "DEGRADED")
    offline = sum(1 for h in states if h.status == "OFFLINE")

    recent = (db.query(Incident).order_by(Incident.created_at.desc())
              .limit(10).all())
    return DashboardSnapshot(
        active_incidents=len(active),
        critical_incidents=critical,
        high_incidents=high,
        cameras_online=online,
        cameras_degraded=degraded,
        cameras_offline=offline,
        recent_incidents=[{
            "incident_id": i.incident_id, "camera_id": i.camera_id,
            "incident_type": i.incident_type, "status": i.status,
            "severity": i.severity, "confidence": i.confidence} for i in recent],
        camera_health=[{
            "camera_id": h.camera_id, "status": h.status, "fps": h.fps,
            "frames_processed": h.frames_processed, "errors": h.errors}
            for h in states],
        system_timestamp=datetime.now(timezone.utc),
    )


@router.get("/events/recent", summary="Recent real-time event envelopes")
def recent_events(
    limit: int = Query(50, ge=1, le=500),
    event_type: Optional[str] = Query(None),
    camera_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
) -> list[dict]:
    """Bounded in-memory event history (newest last)."""
    bus = get_default_bus()
    items = bus.recent(limit=500, event_type=event_type, camera_id=camera_id)
    if severity:
        items = [e for e in items
                 if (e.payload or {}).get("severity") == severity]
    return [e.model_dump(mode="json") for e in items[-limit:]]
