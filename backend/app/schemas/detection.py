"""
Detection schema — represents a single object detection from the CV pipeline.
This is the primary message format AI modules will produce.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, List

from pydantic import BaseModel, Field, field_validator


# [x1, y1, x2, y2] in pixel coordinates
BBox = Annotated[List[float], Field(min_length=4, max_length=4)]


class DetectionSchema(BaseModel):
    camera_id: str = Field(..., description="ID of the camera that produced this detection")
    track_id: int = Field(..., ge=0, description="Tracker-assigned object ID")
    class_name: str = Field(..., min_length=1, description="Detected object class label")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence [0, 1]")
    bbox: BBox = Field(..., description="Bounding box [x1, y1, x2, y2]")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp of detection",
    )

    @field_validator("bbox")
    @classmethod
    def bbox_coords_valid(cls, v: List[float]) -> List[float]:
        x1, y1, x2, y2 = v
        if x2 <= x1:
            raise ValueError("bbox x2 must be greater than x1")
        if y2 <= y1:
            raise ValueError("bbox y2 must be greater than y1")
        return v

    model_config = {"json_schema_extra": {
        "example": {
            "camera_id": "CAM_01",
            "track_id": 42,
            "class_name": "person",
            "confidence": 0.92,
            "bbox": [120.0, 80.0, 240.0, 360.0],
            "timestamp": "2026-09-30T06:00:00Z",
        }
    }}
