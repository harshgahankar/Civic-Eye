"""
Incidents endpoints — Step-4 Incident Intelligence API.

Backed by SQLite persistence (written by the video pipeline).
All errors return proper HTTP codes; internal traces are never exposed.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.database import get_db
from app.db.models import Incident, IncidentEvidence, IncidentStatusHistory
from app.intelligence.lifecycle import InvalidTransitionError, transition
from app.schemas.incident import EvidenceItem

logger = get_logger(__name__)

router = APIRouter(prefix="/incidents", tags=["incidents"])


# ── Response models ───────────────────────────────────────────────────────────

class IncidentSummary(BaseModel):
    incident_id: str
    camera_id: Optional[str] = None
    incident_type: str
    status: str
    severity: str
    confidence: Optional[float] = None
    first_detected_at: Optional[float] = None
    last_updated_at: Optional[float] = None
    track_ids: List[int] = Field(default_factory=list)
    recommended_action: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": False}


class IncidentDetailResponse(IncidentSummary):
    evidence: List[EvidenceItem] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)
    severity_reasons: List[str] = Field(default_factory=list)
    recommended_priority: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _loads(value: Optional[str], default):
    if not value:
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


def _to_summary(row: Incident) -> IncidentSummary:
    return IncidentSummary(
        incident_id=row.incident_id,
        camera_id=row.camera_id,
        incident_type=row.incident_type,
        status=row.status,
        severity=row.severity,
        confidence=row.confidence,
        first_detected_at=row.first_detected_at,
        last_updated_at=row.last_updated_at,
        track_ids=_loads(row.track_ids_json, []),
        recommended_action=row.recommended_action,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _to_detail(row: Incident) -> IncidentDetailResponse:
    return IncidentDetailResponse(
        **_to_summary(row).model_dump(),
        evidence=[EvidenceItem(**e)
                  for e in _loads(row.evidence_json, [])],
        reasons=_loads(row.reasons_json, []),
        severity_reasons=_loads(row.severity_reasons_json, []),
        recommended_priority=row.recommended_priority,
        metadata=_loads(row.metadata_json, {}),
    )


def _get_row_or_404(incident_id: str, db: Session) -> Incident:
    row = db.query(Incident).filter(
        Incident.incident_id == incident_id).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "INCIDENT_NOT_FOUND",
                    "message": f"Incident '{incident_id}' was not found"},
        )
    return row


def _apply_transition(
    row: Incident, target: str, reason: str, db: Session
) -> IncidentDetailResponse:
    try:
        record = transition(row.status, target, reason)
    except InvalidTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "INVALID_TRANSITION", "message": str(exc)},
        )
    row.status = record.new_status
    db.add(IncidentStatusHistory(
        incident_id=row.incident_id,
        previous_status=record.previous_status,
        new_status=record.new_status,
        timestamp=record.timestamp,
        reason=record.reason,
    ))
    db.commit()
    db.refresh(row)
    logger.info(
        {"event": f"incident_{target.lower()}",
         "incident_id": row.incident_id, "camera_id": row.camera_id,
         "type": row.incident_type})
    return _to_detail(row)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[IncidentSummary], summary="List incidents")
def list_incidents(
    camera_id: Optional[str] = Query(None),
    incident_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> List[IncidentSummary]:
    """List incidents with optional filters and pagination."""
    query = db.query(Incident)
    if camera_id:
        query = query.filter(Incident.camera_id == camera_id)
    if incident_type:
        query = query.filter(
            Incident.incident_type == incident_type.upper())
    if severity:
        query = query.filter(Incident.severity == severity.lower())
    if status_filter:
        query = query.filter(Incident.status == status_filter.upper())
    rows = (query.order_by(Incident.created_at.desc())
            .offset(offset).limit(limit).all())
    return [_to_summary(r) for r in rows]


@router.get("/active", response_model=List[IncidentSummary],
            summary="List active incidents")
def list_active_incidents(
    db: Session = Depends(get_db),
) -> List[IncidentSummary]:
    """Incidents still in play: DETECTED / VERIFYING / CONFIRMED / DISPATCHED."""
    rows = (db.query(Incident)
            .filter(Incident.status.in_(
                ["DETECTED", "VERIFYING", "CONFIRMED", "DISPATCHED"]))
            .order_by(Incident.created_at.desc()).all())
    return [_to_summary(r) for r in rows]


@router.get("/{incident_id}", response_model=IncidentDetailResponse,
            summary="Get incident detail")
def get_incident(
    incident_id: str, db: Session = Depends(get_db),
) -> IncidentDetailResponse:
    return _to_detail(_get_row_or_404(incident_id, db))


@router.get("/{incident_id}/evidence", response_model=List[EvidenceItem],
            summary="Get incident evidence")
def get_incident_evidence(
    incident_id: str, db: Session = Depends(get_db),
) -> List[EvidenceItem]:
    row = _get_row_or_404(incident_id, db)
    rows = (db.query(IncidentEvidence)
            .filter(IncidentEvidence.incident_id == row.incident_id)
            .order_by(IncidentEvidence.timestamp.asc()).all())
    if rows:
        return [EvidenceItem(
            type=r.event_type, timestamp=r.timestamp,
            confidence=r.confidence or 0.0,
            track_ids=_loads(r.track_ids_json, []),
            source=r.source or "behavior_engine",
            metadata=_loads(r.metadata_json, {}),
        ) for r in rows]
    # Fallback to the embedded evidence snapshot.
    return [EvidenceItem(**e) for e in _loads(row.evidence_json, [])]


class HistoryResponse(BaseModel):
    previous_status: str
    new_status: str
    timestamp: datetime
    reason: Optional[str] = None

    model_config = {"from_attributes": True}


@router.get("/{incident_id}/history", response_model=List[HistoryResponse],
            summary="Get incident status history")
def get_incident_history(
    incident_id: str, db: Session = Depends(get_db),
) -> List[HistoryResponse]:
    row = _get_row_or_404(incident_id, db)
    rows = (db.query(IncidentStatusHistory)
            .filter(IncidentStatusHistory.incident_id == row.incident_id)
            .order_by(IncidentStatusHistory.id.asc()).all())
    return [HistoryResponse.model_validate(r) for r in rows]


class TransitionRequest(BaseModel):
    reason: str = Field("", max_length=512)


@router.post("/{incident_id}/dispatch", response_model=IncidentDetailResponse,
             summary="Mark incident dispatched")
def dispatch_incident(
    incident_id: str, payload: TransitionRequest,
    db: Session = Depends(get_db),
) -> IncidentDetailResponse:
    row = _get_row_or_404(incident_id, db)
    return _apply_transition(
        row, "DISPATCHED", payload.reason or "response dispatched", db)


@router.post("/{incident_id}/resolve", response_model=IncidentDetailResponse,
             summary="Resolve incident")
def resolve_incident(
    incident_id: str, payload: TransitionRequest,
    db: Session = Depends(get_db),
) -> IncidentDetailResponse:
    row = _get_row_or_404(incident_id, db)
    if row.status == "VERIFYING":
        # Operator judgement on an unverified candidate → false alarm.
        return _apply_transition(
            row, "FALSE_ALARM", payload.reason or "resolved as false alarm",
            db)
    return _apply_transition(
        row, "RESOLVED", payload.reason or "incident resolved", db)
