"""
app/intelligence/persistence.py

SQLite persistence for Step-4 incidents (best-effort — never crashes the
pipeline or API when the database is unavailable).
"""
from __future__ import annotations

import json
from typing import List, Optional

from app.core.logging import get_logger
from app.schemas.incident import IncidentDetail, StatusTransition

logger = get_logger(__name__)


def _dumps(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, default=str)


def upsert_incident(
    detail: IncidentDetail,
    history: List[StatusTransition] | None = None,
) -> bool:
    """Insert or update an incident + evidence + history rows. Returns success."""
    try:
        from app.db.database import SessionLocal
        from app.db.models import Incident, IncidentEvidence, IncidentStatusHistory

        db = SessionLocal()
        try:
            row = db.query(Incident).filter(
                Incident.incident_id == detail.incident_id).first()
            if row is None:
                row = Incident(
                    incident_id=detail.incident_id,
                    incident_type=detail.incident_type,
                    status=detail.status,
                )
                db.add(row)
            row.incident_type = detail.incident_type
            row.status = detail.status
            row.severity = detail.severity.lower()
            row.confidence = detail.confidence
            row.camera_id = detail.camera_id
            row.severity_score = detail.metadata.get("severity_score")
            row.first_detected_at = detail.first_detected_at
            row.last_updated_at = detail.last_updated_at
            row.track_ids_json = _dumps(detail.track_ids)
            row.evidence_json = _dumps([e.model_dump() for e in detail.evidence])
            row.reasons_json = _dumps(detail.reasons)
            row.severity_reasons_json = _dumps(detail.severity_reasons)
            row.recommended_action = detail.recommended_action
            row.recommended_priority = detail.recommended_priority
            row.metadata_json = _dumps(detail.metadata)
            db.flush()

            # Rewrite evidence rows (idempotent snapshot of current evidence).
            db.query(IncidentEvidence).filter(
                IncidentEvidence.incident_id == detail.incident_id).delete()
            for ev in detail.evidence:
                db.add(IncidentEvidence(
                    incident_id=detail.incident_id,
                    event_type=ev.type,
                    timestamp=ev.timestamp,
                    confidence=ev.confidence,
                    track_ids_json=_dumps(ev.track_ids),
                    source=ev.source,
                    metadata_json=_dumps(ev.metadata),
                ))
            # Append new history records only.
            existing = db.query(IncidentStatusHistory).filter(
                IncidentStatusHistory.incident_id == detail.incident_id).count()
            for record in (history or [])[existing:]:
                db.add(IncidentStatusHistory(
                    incident_id=detail.incident_id,
                    previous_status=record.previous_status,
                    new_status=record.new_status,
                    timestamp=record.timestamp,
                    reason=record.reason,
                ))
            db.commit()
            return True
        finally:
            db.close()
    except Exception as exc:
        logger.warning("Incident DB persistence skipped: %s", exc)
        return False


def save_group(group) -> bool:
    """Persist an IncidentGroup snapshot (best-effort)."""
    try:
        from app.db.database import SessionLocal
        from app.db.models import IncidentGroup as GroupRow

        db = SessionLocal()
        try:
            row = db.query(GroupRow).filter(
                GroupRow.group_id == group.group_id).first()
            if row is None:
                row = GroupRow(group_id=group.group_id)
                db.add(row)
            row.primary_incident_id = group.primary_incident_id
            row.primary_camera_id = group.primary_camera_id
            row.member_incident_ids_json = _dumps(
                [m.incident_id for m in group.member_incidents])
            row.related_camera_ids_json = _dumps(group.related_camera_ids)
            row.correlation_confidence = max(
                [m.correlation_score for m in group.member_incidents[1:]]
                or [0.0])
            row.severity = group.severity.lower()
            row.status = group.status
            row.timeline_json = _dumps(group.timeline)
            db.commit()
            return True
        finally:
            db.close()
    except Exception as exc:
        logger.warning("Incident-group DB persistence skipped: %s", exc)
        return False
