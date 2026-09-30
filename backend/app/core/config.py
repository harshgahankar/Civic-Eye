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
