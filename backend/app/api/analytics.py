"""
Analytics endpoints — Phase 1 foundation.
Returns basic counts; full analytics will be built in Phase 2.
"""

from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Alert, Camera, Event, Incident

router = APIRouter(prefix="/analytics", tags=["analytics"])


class AnalyticsSummary(BaseModel):
    total_cameras: int
    active_cameras: int
    total_events: int
    total_incidents: int
    open_incidents: int
    total_alerts: int


@router.get("/summary", response_model=AnalyticsSummary, summary="System summary counts")
def analytics_summary(db: Session = Depends(get_db)) -> AnalyticsSummary:
    return AnalyticsSummary(
        total_cameras=db.query(Camera).count(),
        active_cameras=db.query(Camera).filter(Camera.status == "active").count(),
        total_events=db.query(Event).count(),
        total_incidents=db.query(Incident).count(),
        open_incidents=db.query(Incident).filter(Incident.status == "open").count(),
        total_alerts=db.query(Alert).count(),
    )
