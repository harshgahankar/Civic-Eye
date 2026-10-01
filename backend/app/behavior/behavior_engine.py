"""
app/behavior/behavior_engine.py

BehaviorEngine — main orchestrator for the Behavioral Intelligence Engine.

Processes lists of DetectionEvent objects per frame and emits BehaviorEvent
objects for downstream incident classification.
"""
from __future__ import annotations

import math
from typing import Dict, FrozenSet, List, Optional, Tuple

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.behavior import KinematicState, TrackObservation
from app.schemas.behavior_event import BehaviorEvent
from app.schemas.detection import BBoxModel, DetectionEvent

from app.behavior.track_history import TrackHistory
from app.behavior.kinematics import compute_kinematics, detect_sudden_stop
from app.behavior.trajectory import detect_trajectory_anomaly
from app.behavior.stationary import is_stationary
from app.behavior.collision import (
    CollisionEvidenceBuffer,
    VEHICLE_CLASSES,
    compute_iou,
    compute_center_distance,
    compute_proximity_score,
)
from app.behavior.crowd import CrowdStats, compute_crowd_stats, detect_crowd_anomaly

logger = get_logger(__name__)

# Base pixel distance between two vehicle centres to compare for collision,
# scaled by frame resolution at runtime (large vehicles on 1080p footage can
# have centres far apart while their boxes overlap).
_COLLISION_SPATIAL_THRESHOLD = 300.0
# Fraction of the frame diagonal used as the spatial gate on big frames.
_COLLISION_SPATIAL_SCALE = 0.25
# Two boxes whose centres are closer than this fraction of their smallest
# dimension are the same object detected twice (duplicate YOLO boxes reach
# IoU ~0.97) — never collision evidence.
_COLLISION_DUPLICATE_RATIO = 0.35


class BehaviorEngine:
    """
    Per-camera Behavioral Intelligence Engine.

    Consumes lists of DetectionEvent (one per frame) and emits BehaviorEvent
    objects representing detected behavioral anomalies.
    """

    def __init__(
        self,
        camera_id: str,
        frame_width: int = 640,
        frame_height: int = 480,
    ) -> None:
        self.camera_id = camera_id
        self.frame_width = frame_width
        self.frame_height = frame_height
        self._frame_diagonal = math.sqrt(frame_width ** 2 + frame_height ** 2)

        self._track_history = TrackHistory(
            max_history=settings.TRACK_HISTORY_SIZE,
            timeout_seconds=settings.TRACK_TIMEOUT_SECONDS,
        )

        # {(track_id_a, track_id_b): CollisionEvidenceBuffer}
        # Keys always have track_id_a < track_id_b
        self._collision_buffers: Dict[Tuple[int, int], CollisionEvidenceBuffer] = {}

        # Previous frame crowd stats
        self._prev_crowd_stats: Optional[CrowdStats] = None

        # Deduplication: {(event_type, frozenset(track_ids)): last_emitted_timestamp}
        self._dedup: Dict[Tuple[str, FrozenSet[int]], float] = {}

    # ── Public API ────────────────────────────────────────────────────────

    def process_frame(
        self,
        events: list[DetectionEvent],
        frame_timestamp: float,
    ) -> list[BehaviorEvent]:
        """
        Process all tracked objects in a single frame.

        Parameters
        ----------
        events          : list of DetectionEvent for this frame
        frame_timestamp : float, timestamp in seconds

        Returns
        -------
        list[BehaviorEvent]
        """
        behavior_events: list[BehaviorEvent] = []

        try:
            # ── 1. Update track history ───────────────────────────────────
            for ev in events:
                obs = self._make_observation(ev)
                self._track_history.update(self.camera_id, ev.track_id, obs)

            # ── 2. Cleanup stale tracks ───────────────────────────────────
            self._track_history.cleanup(frame_timestamp)

            # ── 3. Compute kinematics for each track ──────────────────────
            track_kinematics: Dict[int, KinematicState] = {}
            for ev in events:
                history = self._track_history.get_history(self.camera_id, ev.track_id)
                kin = compute_kinematics(history, alpha=settings.VELOCITY_SMOOTHING_ALPHA)
                track_kinematics[ev.track_id] = kin

            # Resolution scale for all pixel thresholds (~800px diagonal
            # reference; 1080p footage has ~2.75x the pixels and the jitter).
            res_scale = max(self._frame_diagonal / 800.0, 0.5)

            # ── 4. Sudden stop detection ──────────────────────────────────
            for ev in events:
                history = self._track_history.get_history(self.camera_id, ev.track_id)
                kin = track_kinematics[ev.track_id]
                triggered, reasons = detect_sudden_stop(
                    history,
                    kin,
                    moving_threshold=settings.MOVING_THRESHOLD * res_scale,
                    stopped_threshold=settings.STOPPED_THRESHOLD * res_scale,
                    decel_threshold=settings.DECELERATION_THRESHOLD * res_scale,
                )
                if triggered:
                    bev = self._make_event(
                        event_type="SUDDEN_STOP",
                        timestamp=frame_timestamp,
                        track_ids=[ev.track_id],
                        class_names=[ev.class_name],
                        score=min(1.0, kin.speed / max(settings.MOVING_THRESHOLD, 0.1)),
                        confidence=0.75,
                        reasons=reasons,
                        metadata={"speed": kin.speed, "acceleration": kin.acceleration},
                    )
                    behavior_events.append(bev)

            # ── 5. Trajectory anomaly detection ───────────────────────────
            for ev in events:
                history = self._track_history.get_history(self.camera_id, ev.track_id)
                kin = track_kinematics[ev.track_id]
                triggered, confidence, reasons = detect_trajectory_anomaly(
                    history, kin
                )
                if triggered:
                    bev = self._make_event(
                        event_type="TRAJECTORY_ANOMALY",
                        timestamp=frame_timestamp,
                        track_ids=[ev.track_id],
                        class_names=[ev.class_name],
                        score=confidence,
                        confidence=confidence,
                        reasons=reasons,
                        metadata={"direction_label": kin.direction_label},
                    )
                    behavior_events.append(bev)

            # ── 6. Stationary object detection ────────────────────────────
            for ev in events:
                history = self._track_history.get_history(self.camera_id, ev.track_id)
                stat, duration, reasons = is_stationary(
                    history,
                    movement_threshold=settings.STATIONARY_MOVEMENT_THRESHOLD * res_scale,
                    min_duration=settings.STATIONARY_MIN_DURATION,
                )
                if stat:
                    # Score based on how long the object has been stationary
                    score = min(1.0, duration / (settings.STATIONARY_MIN_DURATION * 3))
                    bev = self._make_event(
                        event_type="STATIONARY_OBJECT",
                        timestamp=frame_timestamp,
                        track_ids=[ev.track_id],
                        class_names=[ev.class_name],
                        score=score,
                        confidence=0.8,
                        reasons=reasons,
                        metadata={"duration_seconds": duration},
                    )
                    behavior_events.append(bev)

            # ── 7. Collision detection (vehicle pairs) ────────────────────
            vehicle_events = [
                ev for ev in events
                if ev.class_name.lower() in VEHICLE_CLASSES
            ]

            for i in range(len(vehicle_events)):
                for j in range(i + 1, len(vehicle_events)):
                    ev_a = vehicle_events[i]
                    ev_b = vehicle_events[j]

                    obs_a = self._make_observation(ev_a)
                    obs_b = self._make_observation(ev_b)

                    iou = compute_iou(ev_a.bbox, ev_b.bbox)

                    # Spatial filter: nearby vehicles, scaled to resolution.
                    # Overlapping boxes always compare (large vehicles on HD
                    # footage overlap with centres beyond the base gate).
                    spatial_gate = max(
                        _COLLISION_SPATIAL_THRESHOLD,
                        self._frame_diagonal * _COLLISION_SPATIAL_SCALE,
                    )
                    dist = compute_center_distance(obs_a, obs_b)
                    if dist > spatial_gate and iou <= 0.0:
                        continue

                    # Duplicate suppression: near-identical boxes are one
                    # object detected twice, not two colliding vehicles.
                    min_dim = min(
                        ev_a.bbox.width, ev_a.bbox.height,
                        ev_b.bbox.width, ev_b.bbox.height,
                    )
                    if min_dim > 0 and dist < _COLLISION_DUPLICATE_RATIO * min_dim:
                        continue

                    kin_a = track_kinematics.get(ev_a.track_id, KinematicState())
                    kin_b = track_kinematics.get(ev_b.track_id, KinematicState())

                    proximity = compute_proximity_score(
                        obs_a, obs_b, iou, frame_diagonal=self._frame_diagonal
                    )

                    # Speed change magnitude (use abs acceleration as proxy)
                    speed_change_a = abs(kin_a.acceleration)
                    speed_change_b = abs(kin_b.acceleration)

                    # Direction change: use absolute angular velocity (speed of turn)
                    # For simplicity, use current speed as proxy if low speed = big change
                    dir_change_a = 0.0
                    dir_change_b = 0.0
                    history_a = self._track_history.get_history(self.camera_id, ev_a.track_id)
                    history_b = self._track_history.get_history(self.camera_id, ev_b.track_id)

                    if len(history_a) >= 4:
                        from app.behavior.trajectory import compute_direction_change
                        dc_a, _ = compute_direction_change(history_a[-4:])
                        dir_change_a = dc_a

                    if len(history_b) >= 4:
                        from app.behavior.trajectory import compute_direction_change
                        dc_b, _ = compute_direction_change(history_b[-4:])
                        dir_change_b = dc_b

                    pair_key = (
                        min(ev_a.track_id, ev_b.track_id),
                        max(ev_a.track_id, ev_b.track_id),
                    )
                    if pair_key not in self._collision_buffers:
                        self._collision_buffers[pair_key] = CollisionEvidenceBuffer()

                    buf = self._collision_buffers[pair_key]
                    buf.add_evidence(
                        timestamp=frame_timestamp,
                        proximity=proximity,
                        speed_change_a=speed_change_a,
                        speed_change_b=speed_change_b,
                        direction_change_a=dir_change_a,
                        direction_change_b=dir_change_b,
                        iou=iou,
                    )

                    if buf.is_confirmed(
                        min_frames=settings.COLLISION_MIN_EVIDENCE_FRAMES,
                        window_seconds=settings.COLLISION_CONFIRMATION_WINDOW,
                    ):
                        scores = buf.compute_score()
                        final_score = scores["final_score"]
                        reasons = [
                            f"proximity_score={scores['proximity_score']:.2f}",
                            f"speed_change_score={scores['speed_change_score']:.2f}",
                            f"overlap_score={scores['overlap_score']:.2f}",
                        ]
                        bev = self._make_event(
                            event_type="POSSIBLE_COLLISION",
                            timestamp=frame_timestamp,
                            track_ids=[ev_a.track_id, ev_b.track_id],
                            class_names=[ev_a.class_name, ev_b.class_name],
                            score=final_score,
                            confidence=final_score,
                            reasons=reasons,
                            metadata=scores,
                        )
                        behavior_events.append(bev)
                        # Clear after emission to avoid flooding
                        buf.clear()

            # ── 8. Crowd stats ────────────────────────────────────────────
            # Rider/passenger filter: a "person" box that sits inside a
            # vehicle box is a rider/driver/pillion (two-wheelers) or a
            # passenger seen through a bus/car window — not a pedestrian.
            # Without this, dense traffic counts its riders/passengers as a
            # "crowd" and normal flow trips the anomaly.
            person_events = [ev for ev in events if ev.class_name.lower() == "person"]
            vehicle_boxes = [ev.bbox for ev in vehicle_events]
            pedestrian_events: list[DetectionEvent] = []
            for pev in person_events:
                pcx = (pev.bbox.x1 + pev.bbox.x2) / 2.0
                pcy = (pev.bbox.y1 + pev.bbox.y2) / 2.0
                pw = max(pev.bbox.x2 - pev.bbox.x1, 1e-6)
                ph = max(pev.bbox.y2 - pev.bbox.y1, 1e-6)
                p_area = pw * ph
                inside_vehicle = False
                for vb in vehicle_boxes:
                    # (a) centre inside vehicle box (riders, bus passengers).
                    if (vb.x1 - 5.0 <= pcx <= vb.x2 + 5.0
                            and vb.y1 - 5.0 <= pcy <= vb.y2 + 5.0):
                        inside_vehicle = True
                        break
                    # (b) large overlap: person box mostly covered by a
                    # vehicle box (passenger at a bus window whose centre
                    # falls just outside the bus edge, or a loose rider box).
                    ix1, iy1 = max(pev.bbox.x1, vb.x1), max(pev.bbox.y1, vb.y1)
                    ix2, iy2 = min(pev.bbox.x2, vb.x2), min(pev.bbox.y2, vb.y2)
                    if ix2 > ix1 and iy2 > iy1:
                        overlap = ((ix2 - ix1) * (iy2 - iy1)) / p_area
                        if overlap >= 0.3:
                            inside_vehicle = True
                            break
                if not inside_vehicle:
                    pedestrian_events.append(pev)
            rider_filtered = len(person_events) - len(pedestrian_events)

            person_obs = [self._make_observation(ev) for ev in pedestrian_events]
            person_kins = [
                track_kinematics.get(ev.track_id, KinematicState())
                for ev in pedestrian_events
            ]
            vehicle_count = len(vehicle_events)

            roi = None
            if settings.CROWD_DENSITY_ROI:
                try:
                    parts = [float(x) for x in settings.CROWD_DENSITY_ROI.split(",")]
                    if len(parts) == 4:
                        roi = tuple(parts)  # type: ignore
                except ValueError:
                    pass

            current_crowd = compute_crowd_stats(
                person_obs, person_kins,
                self.frame_width, self.frame_height,
                roi=roi,
            )

            # ── 9. Crowd anomaly detection ────────────────────────────────
            # res_scale defined in §4. Smooth the average speed first so
            # single-frame track jitter cannot dominate.
            alpha = settings.VELOCITY_SMOOTHING_ALPHA
            if self._prev_crowd_stats is not None:
                current_crowd.average_speed = round(
                    alpha * current_crowd.average_speed
                    + (1.0 - alpha) * self._prev_crowd_stats.average_speed, 4)
            triggered, confidence, reasons = detect_crowd_anomaly(
                current_crowd, self._prev_crowd_stats,
                count_change_threshold=settings.CROWD_COUNT_CHANGE_THRESHOLD,
                speed_change_threshold=settings.CROWD_SPEED_CHANGE_BASE * res_scale,
                dispersion_threshold=settings.CROWD_DISPERSION_THRESHOLD,
                vehicle_count=vehicle_count,
                min_persons=settings.CROWD_MIN_PERSONS,
                min_absolute_change=settings.CROWD_COUNT_MIN_ABSOLUTE_CHANGE,
            )
            if triggered:
                bev = self._make_event(
                    event_type="CROWD_MOVEMENT_ANOMALY",
                    timestamp=frame_timestamp,
                    track_ids=[ev.track_id for ev in pedestrian_events],
                    class_names=["person"] * len(pedestrian_events),
                    score=confidence,
                    confidence=confidence,
                    reasons=reasons,
                    metadata={
                        "person_count": current_crowd.person_count,
                        "average_speed": current_crowd.average_speed,
                        "direction_dispersion": current_crowd.direction_dispersion,
                        "vehicle_count": vehicle_count,
                        "rider_filtered": rider_filtered,
                    },
                )
                behavior_events.append(bev)

            self._prev_crowd_stats = current_crowd

            # ── 10. Deduplication ─────────────────────────────────────────
            deduped: list[BehaviorEvent] = []
            for bev in behavior_events:
                dedup_key = (bev.event_type, frozenset(bev.track_ids))
                last_ts = self._dedup.get(dedup_key)
                # Sustained overlap must re-emit: a crash keeps two boxes
                # overlapped for seconds, and the incident verifier needs
                # repeated evidence. A 5 s cooldown would let a single
                # collision signal through per clip — too thin to ever
                # verify. Other signals keep the long cooldown.
                cooldown = (
                    settings.COLLISION_REEMIT_SECONDS
                    if bev.event_type == "POSSIBLE_COLLISION"
                    else settings.COLLISION_EVENT_COOLDOWN
                )
                if last_ts is None or (frame_timestamp - last_ts) >= cooldown:
                    self._dedup[dedup_key] = frame_timestamp
                    deduped.append(bev)

            return deduped

        except Exception:
            logger.exception(
                "[BEHAVIOR][%s] Error processing frame at t=%.3f",
                self.camera_id,
                frame_timestamp,
            )
            return []

    def process_detection(self, event: DetectionEvent) -> list[BehaviorEvent]:
        """
        Process a single DetectionEvent (single-track update).
        Uses the event's timestamp as the frame timestamp.
        """
        return self.process_frame([event], event.timestamp)

    def reset(self) -> None:
        """Reset all state (use when starting a new video/job)."""
        self._track_history.reset()
        self._collision_buffers.clear()
        self._prev_crowd_stats = None
        self._dedup.clear()

    # ── Internal helpers ──────────────────────────────────────────────────

    @staticmethod
    def _make_observation(event: DetectionEvent) -> TrackObservation:
        """Convert a DetectionEvent to a TrackObservation."""
        cx = (event.bbox.x1 + event.bbox.x2) / 2.0
        cy = (event.bbox.y1 + event.bbox.y2) / 2.0
        w = event.bbox.x2 - event.bbox.x1
        h = event.bbox.y2 - event.bbox.y1
        return TrackObservation(
            timestamp=event.timestamp,
            frame_number=event.frame_number,
            center_x=cx,
            center_y=cy,
            width=w,
            height=h,
            confidence=event.confidence,
            class_name=event.class_name,
        )

    def _make_event(
        self,
        event_type: str,
        timestamp: float,
        track_ids: list[int],
        class_names: list[str],
        score: float,
        confidence: float,
        reasons: list[str],
        metadata: dict,
    ) -> BehaviorEvent:
        """Build a BehaviorEvent, clamping score/confidence to [0, 1]."""
        return BehaviorEvent(
            event_type=event_type,
            camera_id=self.camera_id,
            timestamp=timestamp,
            confidence=float(min(1.0, max(0.0, confidence))),
            track_ids=track_ids,
            class_names=class_names,
            score=float(min(1.0, max(0.0, score))),
            reasons=reasons,
            metadata=metadata,
        )
