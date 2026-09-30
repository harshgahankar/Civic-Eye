"""
app/intelligence/multi_camera.py

Multi-camera fusion: evidence-based candidate association of incidents
across cameras into unified real-world groups.

Correlation is a weighted, deterministic score — it reports "correlated
incident" with a "correlation confidence", never a claim of guaranteed
physical identity. Merging preserves every original incident record.
"""
from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any, Callable

from app.core.config import settings
from app.core.logging import get_logger
from app.intelligence.incident_group import GroupMember, IncidentGroup
from app.intelligence.timeline import build_timeline

logger = get_logger(__name__)

# Score weights (spec §9).
_W_TEMPORAL = 0.30
_W_TOPOLOGY = 0.25
_W_TYPE = 0.15
_W_ZONE = 0.10
_W_CLASS = 0.10
_W_EVIDENCE = 0.10

_MAX_STORE = 500


class MultiCameraFusionEngine:
    """Correlate incidents across cameras using topology + evidence."""

    def __init__(
        self,
        topology_provider: Callable[
            [str, str], tuple[bool, float | None]] | None = None,
        zone_provider: Callable[[str], str | None] | None = None,
        time_window: float | None = None,
        threshold: float | None = None,
        on_merge: Callable[[IncidentGroup, Any], None] | None = None,
    ) -> None:
        self._topology = topology_provider or (lambda a, b: (False, None))
        self._zones = zone_provider or (lambda cam: None)
        self._window = (time_window if time_window is not None
                        else settings.MULTI_CAMERA_TIME_WINDOW_SECONDS)
        self._threshold = (threshold if threshold is not None
                           else settings.MULTI_CAMERA_CORRELATION_THRESHOLD)
        self._on_merge = on_merge
        self._incidents: deque = deque(maxlen=_MAX_STORE)
        self._groups: dict[str, IncidentGroup] = {}
        self._grouped: set[str] = set()  # incident_ids already merged

    # ── Public API ────────────────────────────────────────────────────────

    def process_incident(self, incident) -> IncidentGroup | None:
        """Ingest an incident; return a group if a merge happened."""
        self._remember(incident)
        if not settings.MULTI_CAMERA_ENABLED:
            return None
        related = self.find_related_incidents(incident)
        if not related:
            return None
        best, score = related[0]
        return self.merge_incidents(incident, best, score)

    def find_related_incidents(
        self, incident
    ) -> list[tuple[Any, float]]:
        """Score candidates (filtered by window/topology/type first)."""
        out: list[tuple[Any, float]] = []
        for other in self._incidents:
            if other.incident_id == incident.incident_id:
                continue
            if other.camera_id == incident.camera_id:
                continue  # cross-camera only
            if other.incident_id in self._grouped:
                continue
            dt = abs(incident.first_detected_at - other.first_detected_at)
            if dt > self._window:
                continue  # 1. time-window pre-filter
            related, _ = self._topology(incident.camera_id, other.camera_id)
            zone_a = self._zones(incident.camera_id)
            zone_b = self._zones(other.camera_id)
            same_zone = zone_a is not None and zone_a == zone_b
            if not related and not same_zone:
                continue  # 2. topology/zone pre-filter
            if other.incident_type != incident.incident_type:
                # 3. type pre-filter (correlation needs same type)
                continue
            score = self.calculate_correlation_score(incident, other)
            if score >= self._threshold:
                out.append((other, score))
        out.sort(key=lambda pair: pair[1], reverse=True)
        return out

    def calculate_correlation_score(self, a, b) -> float:
        """Weighted deterministic correlation score in [0, 1]."""
        dt = abs(a.first_detected_at - b.first_detected_at)
        temporal = max(0.0, 1.0 - dt / max(self._window, 0.1))
        related, estimate = self._topology(a.camera_id, b.camera_id)
        if related and estimate is not None and \
                abs(dt - estimate) <= 0.5 * self._window:
            temporal = min(1.0, temporal + 0.2)

        topology = 1.0 if related else 0.0
        type_score = 1.0 if a.incident_type == b.incident_type else 0.0

        zone_a, zone_b = self._zones(a.camera_id), self._zones(b.camera_id)
        if zone_a is not None and zone_b is not None:
            zone = 1.0 if zone_a == zone_b else 0.0
        else:
            zone = 0.5  # unknown zones are neutral, never decisive

        set_a = {str(c).lower() for c in (a.class_names or [])}
        set_b = {str(c).lower() for c in (b.class_names or [])}
        if not set_a and not set_b:
            class_sim = 0.5
        elif not set_a or not set_b:
            class_sim = 0.0
        else:
            class_sim = len(set_a & set_b) / len(set_a | set_b)

        ev_a = {e.type for e in a.evidence}
        ev_b = {e.type for e in b.evidence}
        if not ev_a or not ev_b:
            ev_sim = 0.0
        else:
            ev_sim = len(ev_a & ev_b) / len(ev_a | ev_b)

        score = (_W_TEMPORAL * temporal + _W_TOPOLOGY * topology
                 + _W_TYPE * type_score + _W_ZONE * zone
                 + _W_CLASS * class_sim + _W_EVIDENCE * ev_sim)
        return round(min(1.0, max(0.0, score)), 4)

    def merge_incidents(
        self, a, b, score: float
    ) -> IncidentGroup:
        """Merge two correlated incidents into a unified group.

        The earlier (or more confident) incident is primary. Both originals
        are preserved; the primary gains related_* links + timeline.
        """
        primary, secondary = (
            (a, b) if (a.first_detected_at, -a.confidence)
            <= (b.first_detected_at, -b.confidence) else (b, a))
        group = IncidentGroup(
            primary_incident_id=primary.incident_id,
            primary_camera_id=primary.camera_id,
            member_incidents=[
                GroupMember(incident_id=primary.incident_id,
                            camera_id=primary.camera_id,
                            correlation_score=1.0),
                GroupMember(incident_id=secondary.incident_id,
                            camera_id=secondary.camera_id,
                            correlation_score=score),
            ],
            related_camera_ids=sorted({primary.camera_id,
                                       secondary.camera_id}),
            start_time=min(primary.first_detected_at,
                           secondary.first_detected_at),
            last_updated=max(primary.last_updated_at,
                             secondary.last_updated_at),
            severity=_higher_severity(primary.severity, secondary.severity),
            confidence=round(max(primary.confidence,
                                 secondary.confidence), 4),
            status="OPEN",
        )
        group.timeline = build_timeline(
            [primary, secondary],
            merges=[{"timestamp": time.time(),
                     "primary": primary.incident_id,
                     "merged": secondary.incident_id, "score": score}])
        self._groups[group.group_id] = group
        self._grouped.add(primary.incident_id)
        self._grouped.add(secondary.incident_id)

        # Link back onto the primary (unified view, originals preserved).
        primary.related_incident_ids = [secondary.incident_id]
        primary.related_camera_ids = [secondary.camera_id]
        primary.primary_camera_id = primary.camera_id
        primary.correlation_confidence = score
        primary.incident_group_id = group.group_id
        primary.timeline = group.timeline

        logger.info({"event": "incident_merged",
                     "group_id": group.group_id,
                     "primary_incident": primary.incident_id,
                     "related_incident": secondary.incident_id,
                     "correlation_score": score,
                     "cameras": [primary.camera_id, secondary.camera_id]})
        if self._on_merge is not None:
            try:
                self._on_merge(group, primary)
            except Exception:
                logger.exception("Fusion on_merge callback failed")
        return group

    def get_incident(self, incident_id: str):
        for item in self._incidents:
            if item.incident_id == incident_id:
                return item
        return None

    def get_group(self, group_id: str) -> IncidentGroup | None:
        return self._groups.get(group_id)

    def all_groups(self) -> list[IncidentGroup]:
        return list(self._groups.values())

    def reset(self) -> None:
        self._incidents.clear()
        self._groups.clear()
        self._grouped.clear()

    # ── internals ─────────────────────────────────────────────────────────

    def _remember(self, incident) -> None:
        self._incidents = deque(
            (i for i in self._incidents
             if incident.last_updated_at - i.last_updated_at <= self._window
             or i.incident_id == incident.incident_id),
            maxlen=_MAX_STORE)
        if not any(i.incident_id == incident.incident_id
                   for i in self._incidents):
            self._incidents.append(incident)


_fusion_engine: "MultiCameraFusionEngine | None" = None
_fusion_lock = threading.Lock()


def get_fusion_engine() -> "MultiCameraFusionEngine":
    """Process-wide fusion engine with DB-backed topology (lazy singleton)."""
    global _fusion_engine
    with _fusion_lock:
        if _fusion_engine is None:
            _fusion_engine = MultiCameraFusionEngine(
                topology_provider=_db_topology,
                zone_provider=_db_zone,
            )
        return _fusion_engine


def _db_topology(source: str, target: str) -> tuple[bool, float | None]:
    try:
        from app.core.config import settings as _settings
        from app.db.database import SessionLocal
        from app.db.models import CameraRelationship
        db = SessionLocal()
        try:
            rows = (
                db.query(CameraRelationship)
                .filter(
                    ((CameraRelationship.source_camera_id == source)
                     & (CameraRelationship.target_camera_id == target))
                    | ((CameraRelationship.source_camera_id == target)
                       & (CameraRelationship.target_camera_id == source)))
                .all()
            )
            if not rows:
                return False, None
            estimates = [r.estimated_transition_seconds for r in rows
                         if r.estimated_transition_seconds is not None]
            estimate = (min(estimates) if estimates
                        else _settings.MULTI_CAMERA_TIME_WINDOW_SECONDS)
            return True, estimate
        finally:
            db.close()
    except Exception:
        return False, None


def _db_zone(camera_id: str) -> str | None:
    try:
        from app.db.database import SessionLocal
        from app.db.models import Camera
        db = SessionLocal()
        try:
            row = db.query(Camera).filter(
                Camera.camera_id == camera_id).first()
            return row.zone if row else None
        finally:
            db.close()
    except Exception:
        return None


_SEVERITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def _higher_severity(a: str, b: str) -> str:
    return a if _SEVERITY_RANK.get(a, 0) >= _SEVERITY_RANK.get(b, 0) else b
