"""
Application configuration using Pydantic Settings.
Values are read from environment variables or a .env file.
The application works even without a .env file.
"""

from __future__ import annotations

from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────────────────
    APP_NAME: str = "Civic-Eye"
    APP_ENV: str = "development"
    DEBUG: bool = True
    VERSION: str = "0.1.0"

    # ── Server ────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./sentinel.db"

    # ── Logging ───────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"

    # ── AI / CV ───────────────────────────────────────────────────────────
    YOLO_MODEL: str = "yolo11n.pt"
    AI_CONFIDENCE_THRESHOLD: float = 0.5
    AI_IOU_THRESHOLD: float = 0.45
    AI_DEVICE: str = "auto"          # "auto" | "cpu" | "cuda" | "cuda:0"
    AI_IMAGE_SIZE: int = 640
    AI_FRAME_SKIP: int = 0           # process every N+1 frames (0 = every frame)
    TRACKER_CONFIG: str = "bytetrack.yaml"
    MAX_FPS: float = 15.0
    # ── Perception filtering (anti-ghost) ─────────────────────────────────
    AI_ALLOWED_CLASSES: str = ""     # comma-separated, e.g. "person,car,..."
                                     # empty = allow every YOLO class
    AI_MIN_TRACK_AGE: int = 3        # consecutive frames a track must
                                     # survive before emission (1 = no gating)
    AI_CLASS_CONFIDENCE: str = ""    # per-class overrides, e.g.
                                     # "suitcase:0.25,handbag:0.25"
                                     # (for small/static objects YOLO scores
                                     # low); empty = global threshold for all
    AI_CLASS_ALIASES: str = "backpack:bag,suitcase:bag,handbag:bag"
                                     # normalize confusing sub-labels to one
                                     # generic name (empty = no renaming)

    # ── Behavior Engine ────────────────────────────────────────────────────────
    TRACK_HISTORY_SIZE: int = 30
    TRACK_TIMEOUT_SECONDS: float = 2.0
    VELOCITY_SMOOTHING_ALPHA: float = 0.4
    MOVING_THRESHOLD: float = 3.0          # pixels/sec
    STOPPED_THRESHOLD: float = 1.0         # pixels/sec
    DECELERATION_THRESHOLD: float = 5.0    # pixels/sec²
    STATIONARY_MIN_DURATION: float = 3.0   # seconds
    STATIONARY_MOVEMENT_THRESHOLD: float = 8.0  # max pixel displacement
    COLLISION_MIN_EVIDENCE_FRAMES: int = 3
    COLLISION_CONFIRMATION_WINDOW: float = 2.0
    COLLISION_EVENT_COOLDOWN: float = 5.0
    COLLISION_REEMIT_SECONDS: float = 1.0  # re-emit sustained overlap
    CROWD_DENSITY_ROI: str = ""           # empty = full frame
    CROWD_MIN_PERSONS: int = 5            # min pedestrians for crowd signal
    CROWD_DISPERSION_THRESHOLD: float = 0.65  # direction-chaos bar
    CROWD_COUNT_CHANGE_THRESHOLD: float = 0.5  # relative head-count jump
    CROWD_COUNT_MIN_ABSOLUTE_CHANGE: int = 3   # absolute head-count jump
    CROWD_SPEED_CHANGE_BASE: float = 25.0  # px/s @ ~800px diagonal (scaled)

    # ── Incident Intelligence (Step 4) ─────────────────────────────────────
    INCIDENT_EVIDENCE_WINDOW_SECONDS: float = 5.0
    ACCIDENT_MIN_EVIDENCE: int = 3
    ACCIDENT_CONFIRMATION_THRESHOLD: float = 0.55
    BAGGAGE_STATIONARY_SECONDS: float = 10.0
    BAGGAGE_OWNER_DISTANCE_THRESHOLD: float = 120.0  # pixels
    BAGGAGE_MERGE_DISTANCE: float = 60.0  # px: same-spot flicker tracks merge
    BAGGAGE_CONFIRMATION_THRESHOLD: float = 0.6
    CROWD_ANOMALY_MIN_EVIDENCE: int = 5
    CROWD_ANOMALY_CONFIRMATION_THRESHOLD: float = 0.55
    CROWD_ANOMALY_MIN_SPAN_SECONDS: float = 1.0  # evidence must persist this long
    ACCIDENT_MIN_SPAN_SECONDS: float = 0.5       # (frames alone ≠ persistence)
    INCIDENT_DEDUP_WINDOW_SECONDS: float = 10.0
    INCIDENT_COOLDOWN_SECONDS: float = 30.0
    SEVERITY_HIGH_THRESHOLD: float = 0.6
    SEVERITY_CRITICAL_THRESHOLD: float = 0.85

    # ── Step 5: multi-camera + real-time bus ───────────────────────────────
    MULTI_CAMERA_ENABLED: bool = True
    MULTI_CAMERA_TIME_WINDOW_SECONDS: float = 15.0
    MULTI_CAMERA_CORRELATION_THRESHOLD: float = 0.70
    MAX_EVENT_HISTORY: int = 1000
    WEBSOCKET_HEARTBEAT_SECONDS: int = 30
    CAMERA_OFFLINE_TIMEOUT_SECONDS: float = 10.0
    CAMERA_DEGRADED_FPS_THRESHOLD: float = 5.0
    MAX_WEBSOCKET_CLIENTS: int = 100

    # ── CORS ──────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> List[str]:
        """Accept either a JSON list string or a comma-separated string."""
        if isinstance(v, str):
            # Handle JSON array string: '["http://localhost:3000"]'
            if v.startswith("["):
                import json
                return json.loads(v)
            # Handle comma-separated string
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v  # type: ignore[return-value]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        # Do not raise an error if .env is missing
        extra="ignore",
    )


# Single shared instance imported everywhere
settings = Settings()
