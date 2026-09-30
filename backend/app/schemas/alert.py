"""
Alert schemas — notifications dispatched in response to an incident.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class AlertCreate(BaseModel):
    incident_id: str = Field(..., description="incident_id this alert belongs to")
    alert_type: str = Field(..., min_length=1, max_length=64)
    status: str = Field("pending", pattern=r"^(pending|sent|acknowledged|failed)$")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class AlertResponse(BaseModel):
    id: int
    alert_id: str
    incident_id: str
    alert_type: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
