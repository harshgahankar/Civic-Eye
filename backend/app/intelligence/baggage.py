"""
app/intelligence/baggage.py

Unattended-baggage reasoning (no new model — reuses YOLO + ByteTrack tracks).

Concept
-------
T0: person track near bag track        → OWNER_NEARBY
T1: person moves away                  → OWNER_MOVED_AWAY
T2: person leaves ROI / disappears     → OWNER_LEFT_ROI
T3: bag stationary beyond threshold    → STATIONARY_DURATION

A bag that is merely stationary while its owner stays nearby is NOT
unattended (suppression rule 3). All states are stored as evidence.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from app.core.config import settings
from app.schemas.incident import EvidenceItem


BAG_CLASSES = {"backpack", "suitcase", "handbag", "bag"}

# Owner-state labels stored as evidence types
STATIONARY = "STATIONARY"
OWNER_NEARBY = "OWNER_NEARBY"
OWNER_MOVED_AWAY = "OWNER_MOVED_AWAY"
OWNER_LEFT_ROI = "OWNER_LEFT_ROI"
STATIONARY_DURATION = "STATIONARY_DURATION"


@dataclass
class _BagTrack:
    bag_track_id: int
    class_name: str
    first_seen: float
    last_seen: float
    last_x: float
    last_y: float
    aliases: set = field(default_factory=set)        # flicker track IDs merged in
    seen_classes: set = field(default_factory=set)   # class labels observed
    owner_track_id: Optional[int] = None
    owner_last_x: Optional[float] = None
    owner_last_y: Optional[float] = None
    owner_seen_at: Optional[float] = None
    owner_left_roi: bool = False
    evidence: List[EvidenceItem] = field(default_factory=list)


@dataclass
class BaggageAssessment:
    unattended: bool
    confidence: float
    bag_track_id: int
    bag_class: str = ""
    owner_track_id: int | None = None
    evidence: List[EvidenceItem] = field(default_factory=list)
    reasons: List[str] = field(default_factory=list)


class BaggageTracker:
    """Positional person↔bag association tracker (per camera)."""

    def __init__(
        self,
        stationary_seconds: float | None = None,
        owner_distance: float | None = None,
        merge_distance: float | None = None,
    ) -> None:
        self._stationary_seconds = (
            stationary_seconds
            if stationary_seconds is not None
            else settings.BAGGAGE_STATIONARY_SECONDS
        )
        self._owner_distance = (
            owner_distance
            if owner_distance is not None
            else settings.BAGGAGE_OWNER_DISTANCE_THRESHOLD
        )
        self._merge_distance = (
            merge_distance
            if merge_distance is not None
            else settings.BAGGAGE_MERGE_DISTANCE
        )
        self._bags: Dict[int, _BagTrack] = {}

    def _find_slot(
        self, bag_id: int, bx: float, by: float, timestamp: float
    ) -> _BagTrack | None:
        """Return a live slot at ~the same spot (flicker merge)."""
        for slot in self._bags.values():
            if timestamp - slot.last_seen > 2.0:
                continue
            if math.hypot(bx - slot.last_x, by - slot.last_y) \
                    <= self._merge_distance:
                return slot
        return None

    # ── Positional update (call once per frame with raw tracks) ──────────────

    def update(
        self,
        timestamp: float,
        bag_tracks: List[Tuple[int, str, float, float]],
        person_tracks: List[Tuple[int, float, float]],
        persons_present: bool = True,
    ) -> None:
        """Update bag/person positions.

        bag_tracks    : [(track_id, class_name, center_x, center_y)]
        person_tracks : [(track_id, center_x, center_y)]
        persons_present: False when the frame had no person detections at all
                         (owner may have left the ROI).
        """
        for bag_id, class_name, bx, by in bag_tracks:
            bag = self._bags.get(bag_id)
            if bag is None:
                # YOLO class flicker (suitcase↔handbag↔backpack on the same
                # physical bag) spawns fresh track IDs at ~the same spot.
                # Merge into the nearest live slot instead of splitting the
                # stationary-duration evidence across phantom bags.
                bag = self._find_slot(bag_id, bx, by, timestamp)
            if bag is None:
                bag = _BagTrack(
                    bag_track_id=bag_id,
                    class_name=class_name,
                    first_seen=timestamp,
                    last_seen=timestamp,
                    last_x=bx,
                    last_y=by,
                )
                self._bags[bag_id] = bag
                bag.seen_classes.add(class_name)
                bag.evidence.append(EvidenceItem(
                    type=STATIONARY, timestamp=timestamp, confidence=0.5,
                    track_ids=[bag_id], source="baggage_tracker",
                    metadata={"note": "bag first observed"},
                ))
            else:
                bag.last_seen = timestamp
                bag.last_x, bag.last_y = bx, by
                if bag_id != bag.bag_track_id:
                    bag.aliases.add(bag_id)
                bag.seen_classes.add(class_name)

            # Associate nearest person as owner candidate.
            nearest: Optional[Tuple[int, float]] = None
            for person_id, px, py in person_tracks:
                dist = math.hypot(px - bx, py - by)
                if nearest is None or dist < nearest[1]:
                    nearest = (person_id, dist)

            if nearest is not None:
                person_id, dist = nearest
                if bag.owner_track_id is None:
                    bag.owner_track_id = person_id
                if dist <= self._owner_distance:
                    bag.owner_last_x, bag.owner_last_y = None, None
                    # owner (back) nearby — record once per association change
                    bag.owner_seen_at = timestamp
                    if not any(e.type == OWNER_NEARBY for e in bag.evidence[-3:]):
                        bag.evidence.append(EvidenceItem(
                            type=OWNER_NEARBY, timestamp=timestamp,
                            confidence=0.6, track_ids=[bag_id, person_id],
                            source="baggage_tracker",
                            metadata={"distance_px": round(dist, 1)},
                        ))
                else:
                    bag.owner_last_x = next(
                        (px for pid, px, _ in person_tracks if pid == person_id),
                        None,
                    )
                    if not any(e.type == OWNER_MOVED_AWAY for e in bag.evidence[-3:]):
                        bag.evidence.append(EvidenceItem(
                            type=OWNER_MOVED_AWAY, timestamp=timestamp,
                            confidence=0.7, track_ids=[bag_id, person_id],
                            source="baggage_tracker",
                            metadata={"distance_px": round(dist, 1)},
                        ))
            elif not persons_present and bag.owner_track_id is not None:
                # Owner was known but no persons are visible anymore.
                if not bag.owner_left_roi:
                    bag.owner_left_roi = True
                    bag.evidence.append(EvidenceItem(
                        type=OWNER_LEFT_ROI, timestamp=timestamp,
                        confidence=0.75, track_ids=[bag_id, bag.owner_track_id],
                        source="baggage_tracker", metadata={},
                    ))

    def assess(self, timestamp: float) -> List[BaggageAssessment]:
        """Evaluate all bags; emit assessments for unattended candidates."""
        out: List[BaggageAssessment] = []
        for bag in self._bags.values():
            stationary_for = timestamp - bag.first_seen
            if stationary_for < self._stationary_seconds:
                continue
            owner_away = (
                bag.owner_track_id is not None
                and (
                    bag.owner_left_roi
                    or any(e.type == OWNER_MOVED_AWAY for e in bag.evidence)
                )
            )
            owner_nearby_recent = any(
                e.type == OWNER_NEARBY
                and (timestamp - e.timestamp) < self._stationary_seconds / 2
                for e in bag.evidence
            )
            # RULE 3: stationary bag with owner nearby → NOT unattended.
            if not owner_away or owner_nearby_recent:
                continue
            # Emit duration evidence sparingly: on first crossing + at most
            # every 5 s afterwards (per-frame duplicates bloat incidents).
            recent_duration = next(
                (e for e in reversed(bag.evidence)
                 if e.type == STATIONARY_DURATION
                 and timestamp - e.timestamp < 5.0),
                None,
            )
            if recent_duration is not None:
                continue
            duration_ev = EvidenceItem(
                type=STATIONARY_DURATION, timestamp=timestamp,
                confidence=min(1.0, 0.5 + stationary_for
                               / (self._stationary_seconds * 2)),
                track_ids=[bag.bag_track_id], source="baggage_tracker",
                metadata={"stationary_seconds": round(stationary_for, 1)},
            )
            evidence = [*bag.evidence, duration_ev]
            duration_score = min(1.0, stationary_for
                                 / (self._stationary_seconds * 2))
            confidence = round(min(1.0, 0.45 + 0.35 * duration_score
                                   + (0.15 if bag.owner_left_roi else 0.05)), 4)
            reasons = [
                f"{bag.class_name} stationary for {stationary_for:.1f}s",
                f"associated person (track {bag.owner_track_id}) moved away"
                + (" and left the view" if bag.owner_left_roi else ""),
            ]
            if confidence >= settings.BAGGAGE_CONFIRMATION_THRESHOLD:
                out.append(BaggageAssessment(
                    unattended=True, confidence=confidence,
                    bag_track_id=bag.bag_track_id,
                    bag_class=bag.class_name,
                    owner_track_id=bag.owner_track_id,
                    evidence=evidence, reasons=reasons,
                ))
        return out

    def prune(self, timestamp: float, max_age: float = 120.0) -> None:
        stale = [bid for bid, b in self._bags.items()
                 if timestamp - b.last_seen > max_age]
        for bid in stale:
            del self._bags[bid]

    def reset(self) -> None:
        self._bags.clear()
