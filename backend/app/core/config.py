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
    AI_CONFIDENCE_THRESHOLD: float = 0.35
    AI_IOU_THRESHOLD: float = 0.45
    AI_DEVICE: str = "auto"          # "auto" | "cpu" | "cuda" | "cuda:0"
    AI_IMAGE_SIZE: int = 640
    AI_FRAME_SKIP: int = 0           # process every N+1 frames (0 = every frame)
    TRACKER_CONFIG: str = "bytetrack.yaml"
    MAX_FPS: float = 15.0

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
    CROWD_DENSITY_ROI: str = ""           # empty = full frame

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
