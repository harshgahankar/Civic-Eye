"""
BehaviorEvent — the output schema of the Behavioral Intelligence Engine.
This is the data contract for all downstream incident-classification modules.
"""
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class BehaviorEvent(BaseModel):
    event_id: str = Field(
        default_factory=lambda: f"BEH-{uuid.uuid4().hex[:8].upper()}"
    )
    event_type: str = Field(
        ...,
        description=(
            "POSSIBLE_COLLISION | SUDDEN_STOP | TRAJECTORY_ANOMALY "
            "| STATIONARY_OBJECT | CROWD_MOVEMENT_ANOMALY"
        ),
    )
    camera_id: str
    timestamp: float = Field(..., ge=0.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    track_ids: List[int] = Field(default_factory=list)
    class_names: List[str] = Field(default_factory=list)
    score: float = Field(..., ge=0.0, le=1.0)
    reasons: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "json_schema_extra": {
            "example": {
                "event_id": "BEH-001",
                "event_type": "POSSIBLE_COLLISION",
                "camera_id": "CAM_02",
                "timestamp": 21.42,
                "confidence": 0.91,
                "track_ids": [12, 19],
                "class_names": ["car", "car"],
                "score": 0.91,
                "reasons": ["high vehicle proximity", "rapid deceleration"],
                "metadata": {"proximity_score": 0.92},
            }
        }
    }
