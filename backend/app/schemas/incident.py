"""
Incident schemas — an aggregated, multi-camera safety incident.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


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
