"""
Internal behavioral feature schemas (not exposed directly in API).
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class TrackObservation(BaseModel):
    """A single-frame snapshot stored in track history."""

    timestamp: float
    frame_number: int
    center_x: float
    center_y: float
    width: float
    height: float
    confidence: float
    class_name: str


class KinematicState(BaseModel):
    """Derived motion features for a track at a point in time."""

    speed: float = 0.0              # pixels/sec (smoothed)
    vx: float = 0.0                 # x-component
    vy: float = 0.0                 # y-component
    acceleration: float = 0.0      # pixels/sec² (smoothed)
    direction_angle: float = 0.0   # degrees, atan2(dy,dx)
    direction_label: str = "STATIONARY"
