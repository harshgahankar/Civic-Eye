"""
app/intelligence/evidence.py

Explicit, timestamped, traceable incident evidence.

Every piece of evidence records what was observed, when, how confidently,
which tracks were involved, and where it came from — so any confirmed
incident can explain itself from actual evidence (never hardcoded text).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from app.schemas.behavior_event import BehaviorEvent
from app.schemas.incident import EvidenceItem


@dataclass
class EvidenceBuffer:
    """Time-windowed evidence list for one incident candidate key."""

    window_seconds: float
    _items: List[EvidenceItem] = field(default_factory=list)

    def add(self, item: EvidenceItem) -> None:
        self._items.append(item)
        self.prune(item.timestamp)

    def prune(self, now: float) -> None:
        cutoff = now - self.window_seconds
        self._items = [i for i in self._items if i.timestamp >= cutoff]

    @property
    def items(self) -> List[EvidenceItem]:
        return list(self._items)

    def count(self, event_type: str | None = None) -> int:
        if event_type is None:
            return len(self._items)
        return sum(1 for i in self._items if i.type == event_type)

    def mean_confidence(self) -> float:
        if not self._items:
            return 0.0
        return sum(i.confidence for i in self._items) / len(self._items)

    def span_seconds(self) -> float:
        if len(self._items) < 2:
            return 0.0
        stamps = [i.timestamp for i in self._items]
        return max(stamps) - min(stamps)

    def track_ids(self) -> List[int]:
        seen: List[int] = []
        for item in self._items:
            for tid in item.track_ids:
                if tid not in seen:
                    seen.append(tid)
        return seen


def behavior_event_to_evidence(event: BehaviorEvent) -> EvidenceItem:
    """Convert a BehaviorEvent into storable incident evidence."""
    return EvidenceItem(
        type=event.event_type,
        timestamp=event.timestamp,
        confidence=event.confidence,
        track_ids=list(event.track_ids),
        source="behavior_engine",
        metadata={
            "event_id": event.event_id,
            "camera_id": event.camera_id,
            "score": event.score,
            "reasons": list(event.reasons),
            "class_names": list(event.class_names),
            **dict(event.metadata),
        },
    )


def build_explanation(evidence: List[EvidenceItem]) -> List[str]:
    """Generate human-readable reasons from actual evidence items."""
    reasons: List[str] = []
    by_type: Dict[str, List[EvidenceItem]] = {}
    for item in evidence:
        by_type.setdefault(item.type, []).append(item)

    _DESCRIBE = {
        "POSSIBLE_COLLISION": "vehicle proximity / possible collision signal",
        "SUDDEN_STOP": "rapid deceleration to a stop",
        "TRAJECTORY_ANOMALY": "abnormal trajectory / direction change",
        "STATIONARY_OBJECT": "post-event stationary state",
        "CROWD_MOVEMENT_ANOMALY": "abnormal crowd movement",
    }
    for event_type, items in by_type.items():
        desc = _DESCRIBE.get(event_type, event_type.lower().replace("_", " "))
        best = max(items, key=lambda i: i.confidence)
        reasons.append(
            f"{desc} observed {len(items)}x "
            f"(peak confidence score {best.confidence:.2f})"
        )
    if len(by_type) > 1:
        reasons.append(
            f"multiple behavioral signals agree ({len(by_type)} signal types)"
        )
    return reasons
