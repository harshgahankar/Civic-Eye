"""Shared synthetic builders for Step-4 intelligence tests (no video needed)."""
from __future__ import annotations

from app.schemas.behavior_event import BehaviorEvent
from app.schemas.detection import BBoxModel, DetectionEvent
from app.schemas.incident import EvidenceItem


def bev(
    event_type: str,
    timestamp: float,
    track_ids: list[int] | None = None,
    class_names: list[str] | None = None,
    confidence: float = 0.85,
    score: float | None = None,
    camera_id: str = "CAM_01",
    metadata: dict | None = None,
    reasons: list[str] | None = None,
) -> BehaviorEvent:
    tids = track_ids or [17]
    return BehaviorEvent(
        event_type=event_type,
        camera_id=camera_id,
        timestamp=timestamp,
        confidence=confidence,
        track_ids=tids,
        class_names=class_names or ["car"] * len(tids),
        score=score if score is not None else confidence,
        reasons=reasons or [f"synthetic {event_type}"],
        metadata=metadata or {},
    )


def det(
    track_id: int,
    cx: float,
    cy: float = 200.0,
    w: float = 60.0,
    h: float = 40.0,
    timestamp: float = 0.0,
    frame_number: int = 0,
    class_name: str = "car",
    camera_id: str = "CAM_01",
) -> DetectionEvent:
    return DetectionEvent(
        event_type="OBJECT_TRACKED",
        camera_id=camera_id,
        frame_number=frame_number,
        timestamp=timestamp,
        track_id=track_id,
        class_id=2,
        class_name=class_name,
        confidence=0.9,
        bbox=BBoxModel(
            x1=cx - w / 2, y1=cy - h / 2, x2=cx + w / 2, y2=cy + h / 2),
    )


def ev_item(
    type_: str,
    timestamp: float,
    confidence: float = 0.85,
    track_ids: list[int] | None = None,
) -> EvidenceItem:
    return EvidenceItem(
        type=type_, timestamp=timestamp, confidence=confidence,
        track_ids=track_ids or [17], source="behavior_engine", metadata={},
    )
