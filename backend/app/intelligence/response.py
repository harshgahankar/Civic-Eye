"""
app/intelligence/response.py

Response recommendation engine: incident type + severity → operational
recommendation.

The system ONLY generates recommendations. It never claims emergency
services were contacted — no real-world integration exists.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class ResponseRecommendation:
    recommended_action: str
    recommended_priority: str  # P1 (highest) .. P4 (monitor)
    reasons: List[str] = field(default_factory=list)


_ACTION_TABLE = {
    ("ACCIDENT", "CRITICAL"): (
        "Dispatch traffic response team and medical assistance immediately.",
        "P1",
    ),
    ("ACCIDENT", "HIGH"): (
        "Dispatch traffic response team and medical assistance.",
        "P1",
    ),
    ("ACCIDENT", "MEDIUM"): (
        "Notify traffic monitoring personnel and verify via camera.",
        "P2",
    ),
    ("ACCIDENT", "LOW"): (
        "Continue monitoring; verify with additional evidence.",
        "P3",
    ),
    ("UNATTENDED_BAGGAGE", "CRITICAL"): (
        "Notify security personnel and initiate controlled-area verification.",
        "P1",
    ),
    ("UNATTENDED_BAGGAGE", "HIGH"): (
        "Notify security personnel and initiate controlled-area verification.",
        "P2",
    ),
    ("UNATTENDED_BAGGAGE", "MEDIUM"): (
        "Notify on-site staff to inspect the stationary item.",
        "P3",
    ),
    ("UNATTENDED_BAGGAGE", "LOW"): (
        "Continue monitoring the stationary item.",
        "P4",
    ),
    ("CROWD_ANOMALY", "CRITICAL"): (
        "Notify crowd-management personnel and increase camera monitoring.",
        "P1",
    ),
    ("CROWD_ANOMALY", "HIGH"): (
        "Notify crowd-management personnel and increase camera monitoring.",
        "P2",
    ),
    ("CROWD_ANOMALY", "MEDIUM"): (
        "Increase camera monitoring of the crowd area.",
        "P3",
    ),
    ("CROWD_ANOMALY", "LOW"): (
        "Continue monitoring.",
        "P4",
    ),
}


def recommend(incident_type: str, severity: str) -> ResponseRecommendation:
    """Map (incident_type, severity) to an operational recommendation."""
    incident_type = incident_type.upper()
    severity = severity.upper()
    action, priority = _ACTION_TABLE.get(
        (incident_type, severity),
        ("Continue monitoring.", "P4"),
    )
    return ResponseRecommendation(
        recommended_action=action,
        recommended_priority=priority,
        reasons=[
            f"recommendation for {incident_type} with {severity} severity "
            "(advisory only — no services contacted)",
        ],
    )
