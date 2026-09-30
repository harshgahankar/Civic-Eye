"""
Civic-Eye FastAPI application entry point.

Run from the backend/ directory:
    uvicorn app.main:app --reload
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.db.database import init_db

# ── Bootstrap logging before anything else ───────────────────────────────────
configure_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    # startup
    logger.info(
        "Starting %s v%s [%s]",
        settings.APP_NAME,
        settings.VERSION,
        settings.APP_ENV,
    )
    init_db()
    logger.info("API ready — docs at /docs")
    yield
    # shutdown
    logger.info("%s shutting down.", settings.APP_NAME)


# ── Application factory ───────────────────────────────────────────────────────

def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        description=(
            "Civic-Eye: Real-Time Computer Vision for Public Safety. "
            "Phase 1 — Backend Foundation."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Global exception handler ──────────────────────────────────────────
    @application.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception(
            "Unhandled exception on %s %s", request.method, request.url
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred.",
            },
        )

    # ── Routers ───────────────────────────────────────────────────────────
    from app.api.health import router as health_router
    from app.api.cameras import router as cameras_router
    from app.api.incidents import router as incidents_router
    from app.api.analytics import router as analytics_router
    from app.api.processing import router as processing_router

    API_PREFIX = "/api/v1"

    application.include_router(health_router, prefix=API_PREFIX)
    application.include_router(cameras_router, prefix=API_PREFIX)
    application.include_router(incidents_router, prefix=API_PREFIX)
    application.include_router(analytics_router, prefix=API_PREFIX)
    application.include_router(processing_router, prefix=API_PREFIX)

    return application


app = create_app()
