"""
app/intelligence/crowd_anomaly.py

Crowd-anomaly confirmation from Step-3 crowd signals.

Neutral terminology only: the system reports CROWD_ANOMALY (abnormal crowd
movement) — never "panic", "riot" or similar claims. Confirmation requires
persistent anomaly evidence across multiple frames inside a time window.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from app.core.config import settings
from app.schemas.incident import EvidenceItem


@dataclass
class CrowdAnomalyAssessment:
    confirmed: bool
    confidence: float
    evidence: List[EvidenceItem] = field(default_factory=list)
    reasons: List[str] = field(default_factory=list)


def assess_crowd_anomaly(
    evidence: List[EvidenceItem],
    span_seconds: float,
    latest_person_count: int = 0,
    latest_density: float = 0.0,
    latest_vehicle_count: int = 0,
) -> CrowdAnomalyAssessment:
    """Confirm a crowd anomaly from accumulated CROWD_MOVEMENT_ANOMALY items.

    Traffic guard: when vehicles dominate the frame (normal road traffic
    with riders counted as persons), a pedestrian-crowd incident must not
    confirm — require an actually large pedestrian group instead.
    """
    anomaly_items = [e for e in evidence if e.type == "CROWD_MOVEMENT_ANOMALY"]
    if len(anomaly_items) < settings.CROWD_ANOMALY_MIN_EVIDENCE:
        return CrowdAnomalyAssessment(
            confirmed=False, confidence=0.0, evidence=evidence,
            reasons=["insufficient persistent crowd-anomaly evidence"],
        )
    # Fall back to evidence metadata when the caller did not pass an
    # explicit vehicle count (older BehaviorEvents lack the field).
    if latest_vehicle_count <= 0:
        for item in reversed(anomaly_items):
            try:
                latest_vehicle_count = int(item.metadata.get("vehicle_count", 0))
            except (TypeError, ValueError):
                latest_vehicle_count = 0
            if latest_vehicle_count:
                break
    if latest_vehicle_count > latest_person_count and latest_person_count < 8:
        return CrowdAnomalyAssessment(
            confirmed=False, confidence=0.0, evidence=evidence,
            reasons=[f"traffic-dominated scene ({latest_vehicle_count} vehicles "
                     f"vs {latest_person_count} pedestrians): normal flow, "
                     f"not a pedestrian crowd anomaly"],
        )
    # Frame counts alone are not persistence: at 60 fps, 5 frames = 0.08 s
    # of cold-start tracker jitter. Require a real time span.
    if span_seconds < settings.CROWD_ANOMALY_MIN_SPAN_SECONDS:
        return CrowdAnomalyAssessment(
            confirmed=False, confidence=0.0, evidence=evidence,
            reasons=[f"anomaly span {span_seconds:.2f}s below "
                     f"{settings.CROWD_ANOMALY_MIN_SPAN_SECONDS:.1f}s floor"],
        )

    peak = max(e.confidence for e in anomaly_items)
    mean_conf = sum(e.confidence for e in anomaly_items) / len(anomaly_items)
    window = max(settings.INCIDENT_EVIDENCE_WINDOW_SECONDS, 0.1)
    persistence = min(1.0, span_seconds / window)
    count_factor = min(1.0, len(anomaly_items)
                       / (settings.CROWD_ANOMALY_MIN_EVIDENCE * 2))

    confidence = round(min(1.0,
                           0.45 * mean_conf + 0.25 * peak
                           + 0.20 * persistence + 0.10 * count_factor), 4)
    confirmed = confidence >= settings.CROWD_ANOMALY_CONFIRMATION_THRESHOLD

    reasons = [
        f"abnormal crowd movement observed {len(anomaly_items)}x "
        f"over {span_seconds:.1f}s",
        f"mean anomaly score {mean_conf:.2f} (peak {peak:.2f})",
    ]
    if latest_person_count:
        reasons.append(f"{latest_person_count} people in view "
                       f"(relative density {latest_density:.3f})")

    return CrowdAnomalyAssessment(
        confirmed=confirmed, confidence=confidence,
        evidence=evidence, reasons=reasons,
    )
