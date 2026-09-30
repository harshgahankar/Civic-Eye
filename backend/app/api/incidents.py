"""
Incidents endpoints — Phase 1 foundation (read / list only).
Full incident management will be wired up when the AI pipeline lands.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Incident
from app.schemas.incident import IncidentResponse

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=List[IncidentResponse], summary="List incidents")
def list_incidents(db: Session = Depends(get_db)) -> List[Incident]:
    return db.query(Incident).order_by(Incident.created_at.desc()).all()
