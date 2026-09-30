"""
Incident schemas — aggregated, multi-camera safety incidents (Step 4).

Backwards compatible with the Phase-1 IncidentCreate / IncidentResponse
contracts; the Step-4 IncidentDetail model carries the full intelligence
payload (evidence, lifecycle, severity, response recommendation).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class IncidentType(str, Enum):
    ACCIDENT = "ACCIDENT"
    UNATTENDED_BAGGAGE = "UNATTENDED_BAGGAGE"
    CROWD_ANOMALY = "CROWD_ANOMALY"


class IncidentStatus(str, Enum):
    DETECTED = "DETECTED"
    VERIFYING = "VERIFYING"
    CONFIRMED = "CONFIRMED"
    DISPATCHED = "DISPATCHED"
    RESOLVED = "RESOLVED"
    FALSE_ALARM = "FALSE_ALARM"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# ── Phase-1 contracts (kept for backwards compatibility) ──────────────────────

class IncidentCreate(BaseModel):
    incident_type: str = Field(..., min_length=1, max_length=64)
    severity: str = Field("low", pattern=r"^(low|medium|high|critical)$")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    status: str = Field("open", pattern=r"^(open|investigating|resolved|false_alarm)$")
    cameras: List[str] = Field(default_factory=list, description="camera_ids involved")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    model_config = {"json_schema_extra": {
        "example": {
            "incident_type": "crowd_anomaly",
            "severity": "high",
            "confidence": 0.87,
            "status": "open",
            "cameras": ["CAM_01", "CAM_02"],
        }
    }}


class IncidentResponse(BaseModel):
    id: int
    incident_id: str
    incident_type: str
    severity: str
    confidence: Optional[float]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Step-4 evidence ───────────────────────────────────────────────────────────

class EvidenceItem(BaseModel):
    """A single timestamped, traceable piece of incident evidence."""

    type: str = Field(..., description="Behavior event type, e.g. POSSIBLE_COLLISION")
    timestamp: float = Field(..., ge=0.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    track_ids: List[int] = Field(default_factory=list)
    source: str = Field("behavior_engine")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class StatusTransition(BaseModel):
    previous_status: str
    new_status: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reason: str = ""


# ── Step-4 full incident ──────────────────────────────────────────────────────

def _new_incident_id() -> str:
    return f"INC-{uuid.uuid4().hex[:8].upper()}"


class IncidentDetail(BaseModel):
    """Full Step-4 incident payload (API + JSONL contract)."""

    incident_id: str = Field(default_factory=_new_incident_id)
    camera_id: str
    incident_type: str = Field(
        ..., description="ACCIDENT | UNATTENDED_BAGGAGE | CROWD_ANOMALY"
    )
    status: str = Field("DETECTED")
    severity: str = Field("LOW")
    severity_score: float = Field(0.0, ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    first_detected_at: float = Field(..., ge=0.0)
    last_updated_at: float = Field(..., ge=0.0)
    track_ids: List[int] = Field(default_factory=list)
    class_names: List[str] = Field(default_factory=list)
    # ── Step-5 cross-camera grouping (optional; single-camera stays valid) ──
    primary_camera_id: Optional[str] = None
    related_camera_ids: List[str] = Field(default_factory=list)
    related_incident_ids: List[str] = Field(default_factory=list)
    correlation_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    incident_group_id: Optional[str] = None
    timeline: List[Dict[str, Any]] = Field(default_factory=list)
    evidence: List[EvidenceItem] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)
    severity_reasons: List[str] = Field(default_factory=list)
    recommended_action: str = ""
    recommended_priority: str = Field("P3", description="P1 (highest) .. P4 (monitor)")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"json_schema_extra": {
        "example": {
            "incident_id": "INC-000001",
            "camera_id": "CAM-02",
            "incident_type": "ACCIDENT",
            "status": "CONFIRMED",
            "severity": "HIGH",
            "confidence": 0.94,
            "first_detected_at": 21.42,
            "last_updated_at": 24.10,
            "track_ids": [17, 19],
            "evidence": [
                {"type": "POSSIBLE_COLLISION", "confidence": 0.91,
                 "timestamp": 21.42, "track_ids": [17, 19]},
                {"type": "SUDDEN_STOP", "confidence": 0.88,
                 "timestamp": 21.67, "track_ids": [17]},
            ],
            "reasons": ["vehicle trajectory convergence",
                        "rapid deceleration",
                        "post-event stationary state"],
            "recommended_action": "Dispatch traffic response team",
            "metadata": {},
        }
    }}
