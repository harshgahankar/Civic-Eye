"""
app/services/camera_topology.py

Logical camera-topology overlay: neighboring cameras, zones, transition
times. Works with logical camera IDs (CAM-01, …) — no GPS required.
Optional coordinates refine topology when available.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.models import CameraRelationship

logger = get_logger(__name__)

VALID_RELATIONSHIPS = frozenset({"ADJACENT", "OVERLAPPING", "SEQUENTIAL"})


def _validate_camera_id(value: str, field_name: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned or len(cleaned) > 64:
        raise ValueError(f"Invalid {field_name}: must be 1-64 characters")
    return cleaned


@dataclass
class CameraNode:
    camera_id: str
    location_name: str | None = None
    zone: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    neighbors: list[str] = field(default_factory=list)
    estimated_transition_seconds: dict[str, float] = field(default_factory=dict)


def add_relationship(
    db: Session,
    source_camera_id: str,
    target_camera_id: str,
    relationship_type: str = "ADJACENT",
    estimated_transition_seconds: float | None = None,
    distance: float | None = None,
    confidence: float | None = None,
    metadata: dict[str, Any] | None = None,
) -> CameraRelationship:
    """Persist a directed camera relationship (validated)."""
    source = _validate_camera_id(source_camera_id, "source_camera_id")
    target = _validate_camera_id(target_camera_id, "target_camera_id")
    if source == target:
        raise ValueError("A camera cannot relate to itself")
    rel_type = (relationship_type or "ADJACENT").upper()
    if rel_type not in VALID_RELATIONSHIPS:
        raise ValueError(
            f"Invalid relationship_type: {rel_type!r} "
            f"(expected one of {sorted(VALID_RELATIONSHIPS)})")
    if confidence is not None and not 0.0 <= confidence <= 1.0:
        raise ValueError("confidence must be within [0, 1]")
    existing = (
        db.query(CameraRelationship)
        .filter(CameraRelationship.source_camera_id == source,
                CameraRelationship.target_camera_id == target,
                CameraRelationship.relationship_type == rel_type)
        .first()
    )
    if existing is not None:
        raise ValueError(
            f"Relationship {source} → {target} ({rel_type}) already exists")
    row = CameraRelationship(
        source_camera_id=source,
        target_camera_id=target,
        relationship_type=rel_type,
        estimated_transition_seconds=estimated_transition_seconds,
        distance=distance,
        confidence=confidence,
        metadata_json=json.dumps(metadata or {}),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    logger.info({"event": "topology_relationship_added",
                 "source": source, "target": target, "type": rel_type})
    return row


def get_neighbors(db: Session, camera_id: str) -> list[CameraRelationship]:
    """All outgoing relationships for a camera (validated ID)."""
    camera_id = _validate_camera_id(camera_id, "camera_id")
    return (
        db.query(CameraRelationship)
        .filter(CameraRelationship.source_camera_id == camera_id)
        .order_by(CameraRelationship.id.asc())
        .all()
    )


def get_topology(db: Session) -> dict[str, CameraNode]:
    """Full topology as {camera_id: CameraNode} (both directions as neighbors)."""
    rows = db.query(CameraRelationship).order_by(CameraRelationship.id.asc()).all()
    nodes: dict[str, CameraNode] = {}
    for row in rows:
        src = nodes.setdefault(row.source_camera_id,
                               CameraNode(camera_id=row.source_camera_id))
        nodes.setdefault(row.target_camera_id,
                         CameraNode(camera_id=row.target_camera_id))
        if row.target_camera_id not in src.neighbors:
            src.neighbors.append(row.target_camera_id)
        if row.estimated_transition_seconds is not None:
            src.estimated_transition_seconds[row.target_camera_id] = \
                row.estimated_transition_seconds
    # Enrich with registered camera metadata where available.
    try:
        from app.db.models import Camera
        for cam in db.query(Camera).all():
            node = nodes.setdefault(cam.camera_id,
                                    CameraNode(camera_id=cam.camera_id))
            node.location_name = cam.location_name or cam.location
            node.zone = cam.zone
            node.latitude = cam.latitude
            node.longitude = cam.longitude
    except Exception:
        pass
    return nodes


def transition_estimate(
    db: Session, source: str, target: str,
    default_seconds: float = 15.0,
) -> float:
    """Estimated transition seconds between two cameras (fallback: default)."""
    rows = (
        db.query(CameraRelationship)
        .filter(CameraRelationship.source_camera_id == source,
                CameraRelationship.target_camera_id == target)
        .all()
    )
    estimates = [r.estimated_transition_seconds for r in rows
                 if r.estimated_transition_seconds is not None]
    if estimates:
        return min(estimates)
    return default_seconds


def are_related(db: Session, source: str, target: str) -> bool:
    """True when any relationship exists in either direction."""
    return bool(
        db.query(CameraRelationship)
        .filter(
            ((CameraRelationship.source_camera_id == source)
             & (CameraRelationship.target_camera_id == target))
            | ((CameraRelationship.source_camera_id == target)
               & (CameraRelationship.target_camera_id == source)))
        .first()
    )
