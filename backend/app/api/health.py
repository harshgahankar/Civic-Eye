"""
Health-check endpoints.

GET /api/v1/health       — basic liveness probe
GET /api/v1/health/db    — database connectivity probe
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.db.database import check_db_connection

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class DbHealthResponse(BaseModel):
    status: str
    database: str


@router.get("", response_model=HealthResponse, summary="Liveness probe")
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="civic-eye-backend",
        version=settings.VERSION,
    )


@router.get("/db", response_model=DbHealthResponse, summary="Database connectivity probe")
def health_db() -> DbHealthResponse:
    if not check_db_connection():
        raise HTTPException(
            status_code=503,
            detail={"error": "DB_UNAVAILABLE", "message": "Database connection failed"},
        )
    return DbHealthResponse(status="ok", database="connected")
