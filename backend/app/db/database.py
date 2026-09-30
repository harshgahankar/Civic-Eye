"""
SQLAlchemy database engine, session factory, and FastAPI dependency.
"""

from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Engine ────────────────────────────────────────────────────────────────────
# connect_args is only needed for SQLite (thread-safety for FastAPI)
_connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    echo=False,  # set True locally if you want SQL logs
)

# ── Session factory ───────────────────────────────────────────────────────────
SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# ── Declarative base ──────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Shared declarative base — all ORM models inherit from this."""


# ── Helpers ───────────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create all tables defined in models (idempotent)."""
    # Import models so SQLAlchemy registers them before create_all
    import app.db.models  # noqa: F401  (side-effect import)

    Base.metadata.create_all(bind=engine)
    _ensure_step4_columns()
    _ensure_step5_columns()
    logger.info("Database tables created / verified.")


def _ensure_step5_columns() -> None:
    """Add Step-5 columns to pre-existing ``cameras`` tables."""
    from sqlalchemy import inspect, text

    _wanted: dict[str, str] = {
        "location_name": "VARCHAR(256)",
        "zone": "VARCHAR(64)",
        "latitude": "FLOAT",
        "longitude": "FLOAT",
        "is_active": "BOOLEAN",
        "health_status": "VARCHAR(32)",
        "last_seen_at": "DATETIME",
    }
    try:
        with engine.connect() as conn:
            existing = {c["name"] for c in inspect(conn).get_columns("cameras")}
            for col, ddl in _wanted.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE cameras ADD COLUMN {col} {ddl}"))
            conn.commit()
    except Exception as exc:
        logger.warning("Step-5 column migration skipped: %s", exc)


def _ensure_step4_columns() -> None:
    """Add Step-4 columns to pre-existing ``incidents`` tables.

    ``create_all`` does not alter existing tables, so development databases
    created during Steps 1-3 would otherwise lack the new columns.
    Uses ``ALTER TABLE ... ADD COLUMN`` for any missing column.
    """
    from sqlalchemy import inspect, text

    _wanted: dict[str, str] = {
        "camera_id": "VARCHAR(64)",
        "severity_score": "FLOAT",
        "first_detected_at": "FLOAT",
        "last_updated_at": "FLOAT",
        "track_ids_json": "TEXT",
        "evidence_json": "TEXT",
        "reasons_json": "TEXT",
        "severity_reasons_json": "TEXT",
        "recommended_action": "TEXT",
        "recommended_priority": "VARCHAR(16)",
        "metadata_json": "TEXT",
    }
    try:
        with engine.connect() as conn:
            existing = {c["name"] for c in inspect(conn).get_columns("incidents")}
            for col, ddl in _wanted.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE incidents ADD COLUMN {col} {ddl}"))
            conn.commit()
    except Exception as exc:
        logger.warning("Step-4 column migration skipped: %s", exc)


def check_db_connection() -> bool:
    """Return True if a basic query succeeds, False otherwise."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("Database connection check failed: %s", exc)
        return False


# ── FastAPI dependency ────────────────────────────────────────────────────────

def get_db():
    """
    Yield a database session for a single request then close it.

    Usage:
        @router.get("/")
        def endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
