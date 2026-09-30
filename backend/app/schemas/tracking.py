"""
Tracking / processing-job schemas for the Civic-Eye API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(BaseModel):
    """In-memory representation of a processing job."""
    job_id: str
    camera_id: str
    status: str             # QUEUED | RUNNING | COMPLETED | FAILED
    source: str
    output_path: Optional[str] = None
    frames_processed: int = 0
    detections_count: int = 0
    behavior_events_count: int = 0
    average_fps: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


class StartJobRequest(BaseModel):
    video_path: str = Field(..., description="Local path to the video file")
    camera_id: str = Field("CAM_01", description="Logical camera identifier")
    output_path: Optional[str] = Field(
        None,
        description="Output video path (defaults to data/videos/outputs/<name>_tracked.mp4)",
    )

    model_config = {"json_schema_extra": {
        "example": {
            "video_path": "data/videos/sample/test.mp4",
            "camera_id": "CAM_01",
        }
    }}


class StartJobResponse(BaseModel):
    status: str
    camera_id: str
    source: str
    job_id: str
