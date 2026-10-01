"""
app/intelligence/accident.py

Accident confirmation from aggregated behavior evidence.

Transparent, deterministic scoring over five components:

    collision evidence  (POSSIBLE_COLLISION presence + score)
    deceleration        (SUDDEN_STOP presence + score)
    trajectory          (TRAJECTORY_ANOMALY presence + score)
    post-event stillness(STATIONARY_OBJECT presence + score)
    temporal persistence(span + count of the evidence window)

Final confidence is a weighted blend of component scores plus a
cross-signal agreement bonus. All values are bounded to [0, 1] and every
component score is kept in metadata — no calibrated-probability claims.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from app.core.config import settings
from app.schemas.incident import EvidenceItem


@dataclass
class AccidentAssessment:
    confidence: float
    component_scores: Dict[str, float] = field(default_factory=dict)
    reasons: List[str] = field(default_factory=list)

    @property
    def confirmed(self) -> bool:
        return self.confidence >= settings.ACCIDENT_CONFIRMATION_THRESHOLD


def _peak(items: List[EvidenceItem]) -> float:
    return max((i.confidence for i in items), default=0.0)


def assess_accident(
    evidence: List[EvidenceItem],
    span_seconds: float,
) -> AccidentAssessment:
    """Score accident likelihood from aggregated evidence items."""
    if span_seconds < settings.ACCIDENT_MIN_SPAN_SECONDS:
        return AccidentAssessment(
            confidence=0.0,
            component_scores={
                "collision_score": 0.0, "deceleration_score": 0.0,
                "trajectory_score": 0.0, "stationary_score": 0.0,
                "temporal_score": 0.0,
            },
            reasons=[f"evidence span {span_seconds:.2f}s below "
                     f"{settings.ACCIDENT_MIN_SPAN_SECONDS:.1f}s floor"],
        )
    by_type: Dict[str, List[EvidenceItem]] = {}
    for item in evidence:
        by_type.setdefault(item.type, []).append(item)

    collision_items = by_type.get("POSSIBLE_COLLISION", [])
    stop_items = by_type.get("SUDDEN_STOP", []) + by_type.get("RAPID_SLOWDOWN", [])
    traj_items = by_type.get("TRAJECTORY_ANOMALY", [])
    still_items = by_type.get("STATIONARY_OBJECT", [])

    # Each component: peak confidence scaled by support (more repeats → higher,
    # saturating). Deterministic, no randomness.
    def _component(items: List[EvidenceItem]) -> float:
        if not items:
            return 0.0
        peak = _peak(items)
        support = min(1.0, len(items) / 3.0)
        return round(min(1.0, peak * (0.6 + 0.4 * support)), 4)

    collision_score = _component(collision_items)
    deceleration_score = _component(stop_items)
    trajectory_score = _component(traj_items)
    stationary_score = _component(still_items)

    # Temporal persistence: evidence spread over time + enough samples.
    window = max(settings.INCIDENT_EVIDENCE_WINDOW_SECONDS, 0.1)
    span_part = min(1.0, span_seconds / window)
    count_part = min(1.0, len(evidence) / max(settings.ACCIDENT_MIN_EVIDENCE * 2, 1))
    temporal_score = round(0.6 * span_part + 0.4 * count_part, 4)

    final = (
        0.30 * collision_score
        + 0.25 * deceleration_score
        + 0.15 * trajectory_score
        + 0.15 * stationary_score
        + 0.15 * temporal_score
    )
    # Cross-signal agreement bonus: distinct signal types corroborate.
    distinct = sum(
        1 for s in (collision_score, deceleration_score,
                    trajectory_score, stationary_score) if s > 0.0
    )
    if distinct >= 3:
        final += 0.08
    elif distinct == 2:
        final += 0.04
    # Sustained-impact bonus: boxes that REPEATEDLY come together (not just
    # pass near) plus a genuine motion change is the signature of a real
    # crash. Two corroboration paths qualify:
    #   (a) speed collapse to a stop (deceleration / post-impact stillness),
    #   (b) kinematic jolt INSIDE the collision signals (hard acceleration
    #       spike + trajectory swerve) — for impacts where the cars bump
    #       and keep rolling, so no SUDDEN_STOP/STATIONARY_OBJECT is ever
    #       emitted (e.g. car3.mp4: 7x collision, speed_change 1.0, no stop).
    # Passing traffic and side-by-side convoys (small overlaps, jitter
    # trajectory blips, nobody slowing, no jolt) must NOT earn this — so
    # trajectory-only corroboration without a jolt does not qualify. Without
    # this bonus, collision-only evidence caps below the confirmation
    # threshold and genuine 2-car impacts never confirm.
    max_overlap = 0.0
    max_jolt = 0.0
    for item in collision_items:
        try:
            max_overlap = max(max_overlap,
                              float(item.metadata.get("overlap_score", 0.0)))
        except (TypeError, ValueError):
            pass
        try:
            max_jolt = max(max_jolt,
                           float(item.metadata.get("speed_change_score", 0.0)))
        except (TypeError, ValueError):
            pass
    has_stop_corroboration = (deceleration_score > 0.0 or stationary_score > 0.0)
    # Jolt path needs BOTH a hard kinematic spike and an independent
    # direction-change signal — either alone is just noisy traffic.
    has_jolt_corroboration = (max_jolt >= 0.8 and trajectory_score > 0.0)
    sustained_impact = (
        len(collision_items) >= 3 and max_overlap >= 0.02
        and span_seconds >= 1.0
        and (has_stop_corroboration or has_jolt_corroboration)
    )
    if sustained_impact:
        final += 0.15
    final = round(min(1.0, max(0.0, final)), 4)

    reasons: List[str] = []
    if sustained_impact:
        reasons.append(
            f"sustained vehicle overlap (peak IoU {max_overlap:.2f} over "
            f"{len(collision_items)} signals) with corroborating motion change"
        )
    if collision_items:
        reasons.append(
            f"vehicle collision signal observed {len(collision_items)}x "
            f"(peak score {_peak(collision_items):.2f})"
        )
    if stop_items:
        reasons.append(
            f"rapid deceleration/slowdown observed {len(stop_items)}x"
        )
    if traj_items:
        reasons.append("abnormal trajectory / direction change near impact")
    if still_items:
        reasons.append("vehicles stationary after the event")
    if span_seconds >= 1.0:
        reasons.append(f"evidence persisted for {span_seconds:.1f}s")
    if distinct >= 2:
        reasons.append(f"{distinct} independent signal types agree")

    return AccidentAssessment(
        confidence=final,
        component_scores={
            "collision_score": collision_score,
            "deceleration_score": deceleration_score,
            "trajectory_score": trajectory_score,
            "stationary_score": stationary_score,
            "temporal_score": temporal_score,
        },
        reasons=reasons,
    )
