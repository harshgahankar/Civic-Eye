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
    logger.info("Database tables created / verified.")


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
