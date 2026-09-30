"""
Camera request / response schemas.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CameraCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    location: str = Field(..., min_length=1, max_length=256)
    stream_url: Optional[str] = Field(None, max_length=512)
    status: str = Field("active", pattern=r"^(active|inactive|error)$")

    model_config = {"json_schema_extra": {
        "example": {
            "name": "Main Entrance",
            "location": "Building A, Gate 1",
            "stream_url": "rtsp://192.168.1.10:554/stream1",
            "status": "active",
        }
    }}


class CameraUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    location: Optional[str] = Field(None, min_length=1, max_length=256)
    stream_url: Optional[str] = Field(None, max_length=512)
    status: Optional[str] = Field(None, pattern=r"^(active|inactive|error)$")


class CameraResponse(BaseModel):
    id: int
    camera_id: str
    name: str
    location: str
    stream_url: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
