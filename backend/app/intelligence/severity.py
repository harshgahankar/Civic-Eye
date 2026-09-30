"""
app/intelligence/severity.py

Deterministic severity classification (LOW / MEDIUM / HIGH / CRITICAL).

Severity is derived from documented signals — confidence, number of
involved tracks, incident type, persistence and crowd size — never from
random values. These are system classification rules, not claims about
actual real-world danger.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from app.core.config import settings


@dataclass
class SeverityResult:
    severity: str  # LOW | MEDIUM | HIGH | CRITICAL
    severity_score: float
    reasons: List[str] = field(default_factory=list)


def classify_severity(
    incident_type: str,
    confidence: float,
    track_count: int = 1,
    evidence_count: int = 1,
    span_seconds: float = 0.0,
    person_count: int = 0,
    in_sensitive_roi: bool = False,
) -> SeverityResult:
    """Classify severity deterministically from incident signals."""
    score = 0.45 * confidence
    # More involved tracks → higher potential impact (saturating).
    score += 0.15 * min(1.0, max(0, track_count - 1) / 3.0)
    # Stronger temporal evidence → higher severity.
    score += 0.15 * min(1.0, evidence_count / 8.0)
    score += 0.10 * min(1.0, span_seconds / 10.0)
    # Crowd size matters for crowd anomalies especially.
    if incident_type == "CROWD_ANOMALY":
        score += 0.15 * min(1.0, person_count / 20.0)
    else:
        score += 0.05 * min(1.0, person_count / 20.0)
    if in_sensitive_roi:
        score += 0.10
    # Multi-vehicle accidents are inherently more severe.
    if incident_type == "ACCIDENT" and track_count >= 2:
        score += 0.05
    score = round(min(1.0, max(0.0, score)), 4)

    reasons = [
        f"confidence score {confidence:.2f}",
        f"{track_count} track(s) involved, {evidence_count} evidence items "
        f"over {span_seconds:.1f}s",
    ]
    if in_sensitive_roi:
        reasons.append("incident inside configured sensitive ROI")

    high_thr = settings.SEVERITY_HIGH_THRESHOLD
    crit_thr = settings.SEVERITY_CRITICAL_THRESHOLD
    if score >= crit_thr and confidence >= high_thr:
        severity = "CRITICAL"
    elif score >= high_thr or (confidence >= crit_thr and evidence_count >= 4):
        severity = "HIGH"
    elif score >= 0.4 or confidence >= 0.5:
        severity = "MEDIUM"
    else:
        severity = "LOW"
    reasons.append(f"severity score {score:.2f} → {severity}")
    return SeverityResult(severity=severity, severity_score=score, reasons=reasons)
