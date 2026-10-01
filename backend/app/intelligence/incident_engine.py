"""
app/intelligence/incident_engine.py

IncidentEngine — main orchestrator of the Incident Intelligence layer.

    BehaviorEvent
          ↓
    TemporalVerifier (per candidate)
          ↓
    Evidence aggregation
          ↓
    Accident / Baggage / Crowd assessment
          ↓
    FalseAlarmSuppressor
          ↓
    Severity + Response recommendation
          ↓
    Lifecycle state machine
          ↓
    IncidentDetail

Standalone Python component — no FastAPI, no database dependency.
The pipeline (or tests) drives it via process_behavior_events() and
process_detections(); persistence is the caller's responsibility.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.behavior_event import BehaviorEvent
from app.schemas.detection import DetectionEvent
from app.schemas.incident import EvidenceItem, IncidentDetail, StatusTransition

from app.behavior.collision import VEHICLE_CLASSES
from app.intelligence.accident import assess_accident
from app.intelligence.baggage import BaggageTracker
from app.intelligence.crowd_anomaly import assess_crowd_anomaly
from app.intelligence.evidence import (
    behavior_event_to_evidence,
    build_explanation,
)
from app.intelligence.false_alarm import should_suppress
from app.intelligence.lifecycle import InvalidTransitionError, transition
from app.intelligence.response import recommend
from app.intelligence.severity import classify_severity
from app.intelligence.temporal_verifier import TemporalVerifier

logger = get_logger(__name__)

_ACCIDENT_SIGNAL_TYPES = {
    "POSSIBLE_COLLISION",
    "SUDDEN_STOP",
    "TRAJECTORY_ANOMALY",
    "STATIONARY_OBJECT",
}

_BAG_CLASSES = {"backpack", "suitcase", "handbag", "bag"}


class _Candidate:
    """One incident candidate: evidence + lifecycle + dedup bookkeeping."""

    def __init__(self, incident: IncidentDetail) -> None:
        self.incident = incident
        self.history: List[StatusTransition] = []
        self.last_evidence_at: float = incident.first_detected_at
        self.emitted_status: Optional[str] = None  # last status returned to caller


class IncidentEngine:
    """Per-camera incident intelligence orchestrator."""

    def __init__(self, camera_id: str) -> None:
        self.camera_id = camera_id
        self._candidates: Dict[Tuple[str, str], _Candidate] = {}
        self._accident_verifier = TemporalVerifier(
            min_evidence=settings.ACCIDENT_MIN_EVIDENCE,
        )
        self._crowd_verifier = TemporalVerifier(
            min_evidence=settings.CROWD_ANOMALY_MIN_EVIDENCE,
        )
        # Baggage evidence is state-based (owner-away states recorded
        # minutes ago stay relevant) → long window; confirmation still
        # needs repeated assess() hits via mark_verified cooldown.
        self._baggage_verifier = TemporalVerifier(
            window_seconds=120.0, min_evidence=2)
        # (bag_key → fed evidence signatures) so repeated assess() hits
        # never double-feed the same state into the verifier buffer.
        self._baggage_fed: Dict[Tuple[str, str], set] = {}
        self._baggage = BaggageTracker()
        self.false_alarm_count = 0

    # ── Public API ────────────────────────────────────────────────────────

    def process_behavior_event(self, event: BehaviorEvent) -> List[IncidentDetail]:
        return self.process_behavior_events([event])

    def process_behavior_events(
        self, events: List[BehaviorEvent]
    ) -> List[IncidentDetail]:
        """Consume behavior events; return incidents created/updated/confirmed."""
        changed: List[IncidentDetail] = []
        for event in events:
            if event.camera_id != self.camera_id:
                continue
            if event.event_type in _ACCIDENT_SIGNAL_TYPES:
                out = self._handle_accident_signal(event)
            elif event.event_type == "CROWD_MOVEMENT_ANOMALY":
                out = self._handle_crowd_signal(event)
            elif event.event_type == "STATIONARY_OBJECT":
                out = self._handle_stationary_signal(event)
            else:
                continue
            if out is not None:
                changed.append(out)
        # Baggage assessments are driven by process_detections(); also check
        # here in case STATIONARY_OBJECT concerns a bag class.
        return changed

    def process_detections(self, events: List[DetectionEvent]) -> List[IncidentDetail]:
        """Feed raw tracked detections (positional baggage reasoning)."""
        if not events:
            return []
        timestamp = events[0].timestamp
        bag_tracks = [
            (e.track_id, e.class_name,
             (e.bbox.x1 + e.bbox.x2) / 2.0, (e.bbox.y1 + e.bbox.y2) / 2.0)
            for e in events
            if e.class_name.lower() in _BAG_CLASSES
        ]
        person_tracks = [
            (e.track_id,
             (e.bbox.x1 + e.bbox.x2) / 2.0, (e.bbox.y1 + e.bbox.y2) / 2.0)
            for e in events
            if e.class_name.lower() == "person"
        ]
        self._baggage.update(
            timestamp, bag_tracks, person_tracks,
            persons_present=bool(person_tracks),
        )
        return self._assess_baggage(timestamp)

    def sweep(self, timestamp: float) -> List[IncidentDetail]:
        """Expire stale unconfirmed candidates → FALSE_ALARM. Call periodically."""
        changed: List[IncidentDetail] = []
        window = settings.INCIDENT_EVIDENCE_WINDOW_SECONDS * 2
        for key, cand in self._candidates.items():
            inc = cand.incident
            if inc.status in ("CONFIRMED", "DISPATCHED", "RESOLVED", "FALSE_ALARM"):
                continue
            if timestamp - cand.last_evidence_at > window:
                self._set_status(cand, "FALSE_ALARM",
                                 "evidence expired without confirmation")
                self.false_alarm_count += 1
                changed.append(inc)
        self._baggage.prune(timestamp)
        return changed

    def finalize(self, timestamp: float) -> List[IncidentDetail]:
        """End-of-video: every still-unconfirmed candidate becomes FALSE_ALARM.

        A finished upload produces no more frames, so a DETECTED/VERIFYING
        candidate can never gather further evidence. Leaving it VERIFYING
        would flag a clean video as "under review" in the UI even with
        0 confirmed incidents.
        """
        changed: List[IncidentDetail] = []
        for key, cand in self._candidates.items():
            inc = cand.incident
            if inc.status in ("CONFIRMED", "DISPATCHED", "RESOLVED", "FALSE_ALARM"):
                continue
            self._set_status(cand, "FALSE_ALARM",
                             "video ended without confirmation")
            self.false_alarm_count += 1
            changed.append(inc)
        self._baggage.prune(timestamp)
        return changed

    def get_active_incidents(self) -> List[IncidentDetail]:
        return [
            c.incident for c in self._candidates.values()
            if c.incident.status in ("DETECTED", "VERIFYING",
                                     "CONFIRMED", "DISPATCHED")
        ]

    def get_incident(self, incident_id: str) -> Optional[IncidentDetail]:
        for cand in self._candidates.values():
            if cand.incident.incident_id == incident_id:
                return cand.incident
        return None

    def get_history(self, incident_id: str) -> List[StatusTransition]:
        for cand in self._candidates.values():
            if cand.incident.incident_id == incident_id:
                return list(cand.history)
        return []

    def resolve_incident(self, incident_id: str, reason: str = "") -> IncidentDetail:
        cand = self._require(incident_id)
        current = cand.incident.status
        target = "RESOLVED"
        if current == "VERIFYING":
            # Route through FALSE_ALARM is not right for resolve; allow direct
            # VERIFYING → RESOLVED? No — valid paths only. Move to CONFIRMED
            # first is wrong too. Resolve from VERIFYING means operator judged
            # it; record FALSE_ALARM only if evidence was weak — simplest: use
            # lifecycle strictly.
            self._set_status(cand, "FALSE_ALARM", reason or "resolved as false alarm")
            self.false_alarm_count += 1
        else:
            self._set_status(cand, target, reason or "incident resolved")
        return cand.incident

    def dispatch_incident(self, incident_id: str, reason: str = "") -> IncidentDetail:
        cand = self._require(incident_id)
        self._set_status(cand, "DISPATCHED", reason or "response dispatched")
        return cand.incident

    def reset(self) -> None:
        self._candidates.clear()
        self._accident_verifier.reset()
        self._crowd_verifier.reset()
        self._baggage_verifier.reset()
        self._baggage.reset()
        self._baggage_fed.clear()
        self.false_alarm_count = 0

    # ── Accident path ─────────────────────────────────────────────────────

    def _handle_accident_signal(self, event: BehaviorEvent) -> Optional[IncidentDetail]:
        # Traffic accidents involve vehicles. Person-only signals (a pedestrian
        # turning, stopping, or standing in a crowd) must never open an
        # ACCIDENT candidate — dense crowds otherwise spawn one candidate per
        # person track. Events without class info still pass through.
        classes = [c.lower() for c in (event.class_names or [])]
        if classes and not any(c in VEHICLE_CLASSES for c in classes):
            return None
        key = self._accident_key(event)
        item = behavior_event_to_evidence(event)
        result = self._accident_verifier.add(key, item)
        evidence = self._accident_verifier.evidence_for(key)

        cand = self._candidates.get(("ACCIDENT", key[1]))
        if cand is None:
            cand = self._new_candidate(
                "ACCIDENT", key[1], event.timestamp,
                track_ids=list(event.track_ids),
            )
        cand.last_evidence_at = event.timestamp
        self._merge_evidence(cand, evidence, event.timestamp)

        if not result.verified:
            self._ensure_status(cand, "VERIFYING", result.reason)
            return cand.incident if self._is_newly_changed(cand) else None

        assessment = assess_accident(evidence, result.span_seconds)
        suppression = should_suppress(
            "ACCIDENT", evidence, result.mean_confidence, result.span_seconds)
        if suppression.suppressed:
            self.false_alarm_count += 1
            logger.info(
                {"event": "incident_suppressed", "camera_id": self.camera_id,
                 "type": "ACCIDENT", "reason": suppression.reason})
            return None
        if not assessment.confirmed:
            self._ensure_status(cand, "VERIFYING", "accident below threshold")
            return cand.incident if self._is_newly_changed(cand) else None

        self._confirm(cand, assessment.confidence,
                      assessment.component_scores, assessment.reasons,
                      event.timestamp)
        self._accident_verifier.mark_verified(key, event.timestamp)
        return cand.incident

    def _handle_stationary_signal(
        self, event: BehaviorEvent
    ) -> Optional[IncidentDetail]:
        """STATIONARY_OBJECT feeds accident post-event evidence for vehicles,
        or baggage reasoning for bag classes."""
        if event.class_names and all(
            c.lower() in _BAG_CLASSES for c in event.class_names
        ):
            return None  # baggage path uses process_detections()
        return self._handle_accident_signal(event)

    # ── Crowd path ────────────────────────────────────────────────────────

    def _handle_crowd_signal(self, event: BehaviorEvent) -> Optional[IncidentDetail]:
        key = (self.camera_id, "crowd")
        item = behavior_event_to_evidence(event)
        result = self._crowd_verifier.add(key, item)
        evidence = self._crowd_verifier.evidence_for(key)

        cand = self._candidates.get(("CROWD_ANOMALY", "crowd"))
        if cand is None:
            cand = self._new_candidate(
                "CROWD_ANOMALY", "crowd", event.timestamp,
                track_ids=list(event.track_ids),
            )
        cand.last_evidence_at = event.timestamp
        self._merge_evidence(cand, evidence, event.timestamp)

        if not result.verified:
            self._ensure_status(cand, "VERIFYING", result.reason)
            return cand.incident if self._is_newly_changed(cand) else None

        latest_count = int(event.metadata.get("person_count", len(event.track_ids)))
        latest_density = float(event.metadata.get("relative_density", 0.0))
        try:
            latest_vehicles = int(event.metadata.get("vehicle_count", 0))
        except (TypeError, ValueError):
            latest_vehicles = 0
        assessment = assess_crowd_anomaly(
            evidence, result.span_seconds, latest_count, latest_density,
            latest_vehicles)
        suppression = should_suppress(
            "CROWD_ANOMALY", evidence, result.mean_confidence,
            result.span_seconds)
        if suppression.suppressed or not assessment.confirmed:
            if suppression.suppressed:
                self.false_alarm_count += 1
            self._ensure_status(cand, "VERIFYING", "crowd below threshold")
            return cand.incident if self._is_newly_changed(cand) else None

        self._confirm(cand, assessment.confidence,
                      {"person_count": latest_count,
                       "relative_density": latest_density,
                       "vehicle_count": latest_vehicles},
                      assessment.reasons, event.timestamp)
        self._crowd_verifier.mark_verified(key, event.timestamp)
        return cand.incident

    # ── Baggage path ──────────────────────────────────────────────────────

    def _assess_baggage(self, timestamp: float) -> List[IncidentDetail]:
        changed: List[IncidentDetail] = []
        for assessment in self._baggage.assess(timestamp):
            bag_key = (self.camera_id, f"bag-{assessment.bag_track_id}")
            # Feed each evidence state through the verifier for temporal
            # proof — but only once per state (skip already-fed signatures).
            fed = self._baggage_fed.setdefault(bag_key, set())
            result = None
            for item in assessment.evidence:
                sig = (item.type, item.timestamp, tuple(item.track_ids))
                if sig in fed:
                    continue
                fed.add(sig)
                result = self._baggage_verifier.add(bag_key, item)
            if result is None:
                continue  # nothing new since last assessment
            assert result is not None
            evidence = self._baggage_verifier.evidence_for(bag_key)
            cand = self._candidates.get(("UNATTENDED_BAGGAGE", bag_key[1]))
            if cand is None:
                cand = self._new_candidate(
                    "UNATTENDED_BAGGAGE", bag_key[1], timestamp,
                    track_ids=[assessment.bag_track_id],
                )
            cand.last_evidence_at = timestamp
            self._merge_evidence(cand, evidence, timestamp)
            if assessment.bag_class and \
                    assessment.bag_class not in cand.incident.class_names:
                cand.incident.class_names.append(assessment.bag_class)
            if not result.verified:
                self._ensure_status(cand, "VERIFYING", result.reason)
                if self._is_newly_changed(cand):
                    changed.append(cand.incident)
                continue
            suppression = should_suppress(
                "UNATTENDED_BAGGAGE", evidence, result.mean_confidence,
                result.span_seconds)
            if suppression.suppressed:
                self.false_alarm_count += 1
                continue
            self._confirm(cand, assessment.confidence, {},
                          assessment.reasons, timestamp)
            self._baggage_verifier.mark_verified(bag_key, timestamp)
            changed.append(cand.incident)
        return changed

    # ── Candidate helpers ─────────────────────────────────────────────────

    def _accident_key(self, event: BehaviorEvent) -> Tuple[str, str]:
        tids = sorted(event.track_ids)
        if len(tids) >= 2:
            return (self.camera_id, f"acc-{tids[0]}-{tids[1]}")
        if len(tids) == 1:
            # Attach single-track signals to a live candidate with overlap
            # (including CONFIRMED ones — follow-up evidence updates the
            # incident instead of spawning a duplicate).
            for (itype, cid), cand in self._candidates.items():
                if itype != "ACCIDENT":
                    continue
                if tids[0] in cand.incident.track_ids and \
                        cand.incident.status in (
                            "DETECTED", "VERIFYING", "CONFIRMED",
                            "DISPATCHED"):
                    return (self.camera_id, cid)
            return (self.camera_id, f"acc-{tids[0]}")
        return (self.camera_id, "acc-unknown")

    def _new_candidate(
        self, incident_type: str, candidate_id: str,
        timestamp: float, track_ids: List[int],
    ) -> _Candidate:
        incident = IncidentDetail(
            camera_id=self.camera_id,
            incident_type=incident_type,
            status="DETECTED",
            severity="LOW",
            confidence=0.0,
            first_detected_at=timestamp,
            last_updated_at=timestamp,
            track_ids=list(track_ids),
        )
        cand = _Candidate(incident)
        self._candidates[(incident_type, candidate_id)] = cand
        logger.info(
            {"event": "incident_detected", "camera_id": self.camera_id,
             "type": incident_type, "tracks": track_ids})
        return cand

    def _merge_evidence(
        self, cand: _Candidate, evidence: List[EvidenceItem], timestamp: float
    ) -> None:
        seen = {(e.type, e.timestamp, tuple(e.track_ids))
                for e in cand.incident.evidence}
        for item in evidence:
            sig = (item.type, item.timestamp, tuple(item.track_ids))
            if sig not in seen:
                cand.incident.evidence.append(item)
                seen.add(sig)
        for tid in cand.incident.track_ids:
            pass
        # Union track ids + class names from evidence
        tids: List[int] = list(cand.incident.track_ids)
        classes: List[str] = list(cand.incident.class_names)
        for item in cand.incident.evidence:
            for tid in item.track_ids:
                if tid not in tids:
                    tids.append(tid)
            for cls in item.metadata.get("class_names", []):
                if cls not in classes:
                    classes.append(cls)
        cand.incident.track_ids = tids
        cand.incident.class_names = classes
        if cand.incident.evidence:
            earliest = min(e.timestamp for e in cand.incident.evidence)
            if earliest < cand.incident.first_detected_at:
                cand.incident.first_detected_at = earliest
        cand.incident.last_updated_at = timestamp

    def _ensure_status(self, cand: _Candidate, status: str, reason: str) -> None:
        if cand.incident.status == status:
            return
        self._set_status(cand, status, reason)

    def _set_status(self, cand: _Candidate, status: str, reason: str) -> None:
        try:
            record = transition(cand.incident.status, status, reason, cand.history)
        except InvalidTransitionError:
            # Already terminal or same — nothing to do.
            return
        cand.incident.status = record.new_status
        logger.info(
            {"event": f"incident_{status.lower()}",
             "incident_id": cand.incident.incident_id,
             "camera_id": self.camera_id,
             "type": cand.incident.incident_type,
             "confidence": cand.incident.confidence})

    def _is_newly_changed(self, cand: _Candidate) -> bool:
        if cand.emitted_status != cand.incident.status:
            cand.emitted_status = cand.incident.status
            return True
        return False

    def _confirm(
        self, cand: _Candidate, confidence: float,
        component_scores: dict, reasons: List[str], timestamp: float,
    ) -> None:
        inc = cand.incident
        inc.confidence = round(min(1.0, max(0.0, confidence)), 4)
        all_reasons = list(build_explanation(inc.evidence)) + list(reasons)
        # De-duplicate while preserving order
        inc.reasons = list(dict.fromkeys(all_reasons))
        sev = classify_severity(
            inc.incident_type, inc.confidence,
            track_count=len(inc.track_ids),
            evidence_count=len(inc.evidence),
            span_seconds=(inc.last_updated_at - inc.first_detected_at),
            person_count=int(component_scores.get("person_count", 0)),
        )
        inc.severity = sev.severity
        inc.severity_score = sev.severity_score
        inc.severity_reasons = sev.reasons
        rec = recommend(inc.incident_type, sev.severity)
        inc.recommended_action = rec.recommended_action
        inc.recommended_priority = rec.recommended_priority
        inc.metadata = {
            **component_scores,
            "severity_score": sev.severity_score,
            "response_reasons": rec.reasons,
        }
        inc.last_updated_at = timestamp
        for target in ("VERIFYING", "CONFIRMED"):
            if inc.status != target:
                try:
                    self._set_status(cand, target,
                                     "evidence threshold met" if target == "CONFIRMED"
                                     else "gathering evidence")
                except Exception:
                    break
        cand.emitted_status = inc.status
        logger.info(
            {"event": "incident_confirmed",
             "incident_id": inc.incident_id, "camera_id": self.camera_id,
             "type": inc.incident_type, "severity": inc.severity,
             "confidence": inc.confidence})

    def _require(self, incident_id: str) -> _Candidate:
        for cand in self._candidates.values():
            if cand.incident.incident_id == incident_id:
                return cand
        raise KeyError(f"Incident '{incident_id}' not found in engine")
