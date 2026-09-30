"""
Event schemas — a camera-level occurrence (e.g., person detected, crowd threshold crossed).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class EventCreate(BaseModel):
    camera_id: str = Field(..., description="camera_id of the source camera")
    event_type: str = Field(..., min_length=1, max_length=64)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    metadata: Optional[Dict[str, Any]] = Field(None)


class EventResponse(BaseModel):
    id: int
    event_id: str
    camera_id: str
    event_type: str
    confidence: Optional[float]
    timestamp: datetime
    metadata_json: Optional[str]  # raw JSON string from DB

    model_config = {"from_attributes": True}
