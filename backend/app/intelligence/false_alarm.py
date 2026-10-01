"""
app/intelligence/false_alarm.py

False-alarm suppression rules. Every suppression carries a machine-readable
reason code — evidence is never silently discarded.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

from app.schemas.incident import EvidenceItem


@dataclass
class SuppressionDecision:
    suppressed: bool
    reason: str  # e.g. "single_frame_anomaly", "" when not suppressed


# RULE 1 — single-frame anomaly: exactly one evidence item cannot confirm.
# RULE 2 — low-confidence event with no supporting evidence.
# RULE 5 — vehicle proximity without any corroborating collision evidence.
_LOW_CONFIDENCE_THRESHOLD = 0.35


def _has_supporting_types(
    evidence: List[EvidenceItem], primary: str, supporting: set[str]
) -> bool:
    return any(
        item.type in supporting
        for item in evidence
        if item.type != primary or True  # any supporting-typed item counts
    )


def should_suppress(
    candidate_type: str,
    evidence: List[EvidenceItem],
    mean_confidence: float,
    span_seconds: float,
) -> SuppressionDecision:
    """Apply suppression rules to an incident candidate.

    Parameters
    ----------
    candidate_type : ACCIDENT | UNATTENDED_BAGGAGE | CROWD_ANOMALY
    evidence       : current evidence items
    mean_confidence: aggregated evidence confidence
    span_seconds   : temporal span of the evidence
    """
    # RULE 1: single-frame anomaly → suppress
    if len(evidence) <= 1:
        return SuppressionDecision(True, "single_frame_anomaly")

    # RULE 2: low-confidence with no supporting evidence → suppress
    if mean_confidence < _LOW_CONFIDENCE_THRESHOLD:
        return SuppressionDecision(True, "low_confidence_no_support")

    if candidate_type == "ACCIDENT":
        # RULE 5: vehicle proximity alone (only POSSIBLE_COLLISION, nothing
        # else, no temporal span) → suppress
        types = {item.type for item in evidence}
        if types == {"POSSIBLE_COLLISION"} and span_seconds < 1.0:
            return SuppressionDecision(True, "proximity_without_corroboration")

    if candidate_type == "UNATTENDED_BAGGAGE":
        # RULE 3 is evaluated in baggage.py (owner nearby) and surfaces as
        # "owner_nearby" — handled by the caller via assess_baggage; here we
        # only apply the generic single/low-confidence rules above.
        pass

    if candidate_type == "CROWD_ANOMALY":
        # RULE 4: temporary spike lasting < 1s with few samples → suppress
        if span_seconds < 1.0 and len(evidence) < 3:
            return SuppressionDecision(True, "transient_crowd_spike")
        # RULE 6: traffic-dominated crowd signals — vehicles outnumber
        # pedestrians across the evidence window (riders in normal flow
        # counted as persons). Suppress unless a large pedestrian group
        # persists over a real time span.
        if candidate_type == "CROWD_ANOMALY":
            veh_dominated = 0
            ped_total = 0
            for item in evidence:
                try:
                    v = int(item.metadata.get("vehicle_count", 0))
                except (TypeError, ValueError):
                    v = 0
                try:
                    p = int(item.metadata.get("person_count", len(item.track_ids)))
                except (TypeError, ValueError):
                    p = len(item.track_ids)
                ped_total += p
                if v > p:
                    veh_dominated += 1
            if evidence and veh_dominated > len(evidence) // 2:
                avg_ped = ped_total / max(len(evidence), 1)
                if avg_ped < 8 or span_seconds < 3.0:
                    return SuppressionDecision(True, "traffic_dominated_crowd_signal")

    return SuppressionDecision(False, "")
