"""
SQLAlchemy ORM models for Civic-Eye.

Models are intentionally minimal — only the foundational fields required
for Phase 1. AI-specific fields will be added when AI modules land.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


# ── Camera ────────────────────────────────────────────────────────────────────

class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    camera_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=_uuid
    )
    name: Mapped[str] = mapped_column(String(128))
    location: Mapped[str] = mapped_column(String(256))
    stream_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    # ── Step-5 logical-topology / health fields (nullable → compatible) ──
    location_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    zone: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    health_status: Mapped[str] = mapped_column(String(32), default="UNKNOWN")
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    events: Mapped[list["Event"]] = relationship(
        "Event", back_populates="camera", cascade="all, delete-orphan"
    )


# ── Event ─────────────────────────────────────────────────────────────────────

class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=_uuid
    )
    camera_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("cameras.camera_id"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(64))
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    # JSON blob stored as text for simplicity; upgrade to JSON column if needed
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    camera: Mapped["Camera"] = relationship("Camera", back_populates="events")


# ── Incident ──────────────────────────────────────────────────────────────────

class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    incident_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=_uuid
    )
    incident_type: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(32), default="low")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open")
    # ── Step-4 intelligence fields (nullable for backwards compatibility) ──
    camera_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    severity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    first_detected_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_updated_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    track_ids_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    reasons_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity_reasons_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_priority: Mapped[str | None] = mapped_column(String(16), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    alerts: Mapped[list["Alert"]] = relationship(
        "Alert", back_populates="incident", cascade="all, delete-orphan"
    )
    evidence_items: Mapped[list["IncidentEvidence"]] = relationship(
        "IncidentEvidence", back_populates="incident", cascade="all, delete-orphan"
    )
    status_history: Mapped[list["IncidentStatusHistory"]] = relationship(
        "IncidentStatusHistory", back_populates="incident", cascade="all, delete-orphan"
    )


# ── Incident evidence (Step 4) ────────────────────────────────────────────────

class IncidentEvidence(Base):
    __tablename__ = "incident_evidence"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    incident_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("incidents.incident_id"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(64))
    timestamp: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    track_ids_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(64), default="behavior_engine")
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    incident: Mapped["Incident"] = relationship(
        "Incident", back_populates="evidence_items"
    )


# ── Incident status history (Step 4, auditable lifecycle) ─────────────────────

class IncidentStatusHistory(Base):
    __tablename__ = "incident_status_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    incident_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("incidents.incident_id"), index=True
    )
    previous_status: Mapped[str] = mapped_column(String(32))
    new_status: Mapped[str] = mapped_column(String(32))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    incident: Mapped["Incident"] = relationship(
        "Incident", back_populates="status_history"
    )


# ── Alert ─────────────────────────────────────────────────────────────────────

class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    alert_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=_uuid
    )
    incident_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("incidents.incident_id"), index=True
    )
    alert_type: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    incident: Mapped["Incident"] = relationship(
        "Incident", back_populates="alerts"
    )


# ── Camera relationship (Step 5: logical topology overlay) ───────────────────

class CameraRelationship(Base):
    __tablename__ = "camera_relationships"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source_camera_id: Mapped[str] = mapped_column(String(64), index=True)
    target_camera_id: Mapped[str] = mapped_column(String(64), index=True)
    relationship_type: Mapped[str] = mapped_column(
        String(32), default="ADJACENT")  # ADJACENT | OVERLAPPING | SEQUENTIAL
    estimated_transition_seconds: Mapped[float | None] = mapped_column(
        Float, nullable=True)
    distance: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )


# ── Incident group (Step 5: one real-world event, many cameras) ───────────────

class IncidentGroup(Base):
    __tablename__ = "incident_groups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    group_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=_uuid
    )
    primary_incident_id: Mapped[str] = mapped_column(String(64), index=True)
    primary_camera_id: Mapped[str] = mapped_column(String(64), index=True)
    member_incident_ids_json: Mapped[str | None] = mapped_column(
        Text, nullable=True)
    related_camera_ids_json: Mapped[str | None] = mapped_column(
        Text, nullable=True)
    correlation_confidence: Mapped[float | None] = mapped_column(
        Float, nullable=True)
    severity: Mapped[str] = mapped_column(String(32), default="low")
    status: Mapped[str] = mapped_column(String(32), default="OPEN")
    timeline_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


# ── ProcessingJob ─────────────────────────────────────────────────────────────

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=_uuid
    )
    camera_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), default="QUEUED")
    source: Mapped[str] = mapped_column(String(512))
    output_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    frames_processed: Mapped[int] = mapped_column(default=0)
    detections_count: Mapped[int] = mapped_column(default=0)
    average_fps: Mapped[float] = mapped_column(Float, default=0.0)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
