"""
Detection schemas for the Civic-Eye CV pipeline.

DetectionSchema  — original Step-1 schema kept for backward compat.
BBoxModel        — structured bounding-box model (x1,y1,x2,y2).
RawDetection     — single-frame YOLO detection (no track ID).
DetectionEvent   — the canonical event produced after detect+track.
                   This is the data contract consumed by all future
                   analysis modules (accident, crowd, baggage, etc.).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, List

from pydantic import BaseModel, Field, field_validator, model_validator


# ─────────────────────────────────────────────────────────────────────────────
# Bounding box
# ─────────────────────────────────────────────────────────────────────────────

class BBoxModel(BaseModel):
    x1: float = Field(..., description="Left pixel coordinate")
    y1: float = Field(..., description="Top pixel coordinate")
    x2: float = Field(..., description="Right pixel coordinate")
    y2: float = Field(..., description="Bottom pixel coordinate")

    @model_validator(mode="after")
    def validate_coords(self) -> "BBoxModel":
        if self.x2 <= self.x1:
            raise ValueError(f"x2 ({self.x2}) must be greater than x1 ({self.x1})")
        if self.y2 <= self.y1:
            raise ValueError(f"y2 ({self.y2}) must be greater than y1 ({self.y1})")
        return self

    @property
    def width(self) -> float:
        return self.x2 - self.x1

    @property
    def height(self) -> float:
        return self.y2 - self.y1

    @property
    def area(self) -> float:
        return self.width * self.height

    @classmethod
    def from_xyxy(cls, x1: float, y1: float, x2: float, y2: float) -> "BBoxModel":
        return cls(x1=x1, y1=y1, x2=x2, y2=y2)


# ─────────────────────────────────────────────────────────────────────────────
# Raw YOLO detection (before tracking — no track_id)
# ─────────────────────────────────────────────────────────────────────────────

class RawDetection(BaseModel):
    """Single object detection from YOLO, before tracker assignment."""
    class_id: int = Field(..., ge=0)
    class_name: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: BBoxModel


# ─────────────────────────────────────────────────────────────────────────────
# DetectionEvent — the canonical downstream data contract
# ─────────────────────────────────────────────────────────────────────────────

class DetectionEvent(BaseModel):
    """
    A tracked object at a specific frame.

    This is the single data contract all downstream analysis modules consume.
    Future modules (accident.py, crowd.py, baggage.py) receive lists of these
    without needing to know anything about YOLO or ByteTrack internals.
    """
    event_type: str = Field("OBJECT_TRACKED", description="Event type label")
    camera_id: str = Field(..., description="Source camera identifier")
    frame_number: int = Field(..., ge=0, description="Zero-based frame index")
    timestamp: float = Field(..., ge=0.0, description="Frame timestamp in seconds")
    track_id: int = Field(..., ge=0, description="Stable tracker-assigned object ID")
    class_id: int = Field(..., ge=0, description="YOLO class index")
    class_name: str = Field(..., min_length=1, description="YOLO class label")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    bbox: BBoxModel

    model_config = {
        "json_schema_extra": {
            "example": {
                "event_type": "OBJECT_TRACKED",
                "camera_id": "CAM_01",
                "frame_number": 143,
                "timestamp": 12.42,
                "track_id": 17,
                "class_id": 2,
                "class_name": "car",
                "confidence": 0.94,
                "bbox": {"x1": 120, "y1": 230, "x2": 420, "y2": 480},
            }
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# Legacy Step-1 schema — preserved for backward compatibility
# ─────────────────────────────────────────────────────────────────────────────

# [x1, y1, x2, y2] in pixel coordinates
_BBoxList = Annotated[List[float], Field(min_length=4, max_length=4)]


class DetectionSchema(BaseModel):
    """Original flat detection schema from Step 1. Still used by Step-1 tests."""
    camera_id: str = Field(..., description="ID of the camera that produced this detection")
    track_id: int = Field(..., ge=0, description="Tracker-assigned object ID")
    class_name: str = Field(..., min_length=1, description="Detected object class label")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence [0, 1]")
    bbox: _BBoxList = Field(..., description="Bounding box [x1, y1, x2, y2]")
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
