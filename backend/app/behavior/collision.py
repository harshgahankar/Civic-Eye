"""
app/behavior/collision.py

Collision detection between vehicle tracks using proximity, IoU, and
kinematic evidence accumulated over multiple frames.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.behavior import TrackObservation
from app.schemas.detection import BBoxModel

# Vehicle class names considered for collision detection
VEHICLE_CLASSES: set[str] = {"car", "motorcycle", "bus", "truck", "bicycle"}

# Assumed frame diagonal for distance normalisation when not provided
_DEFAULT_DIAGONAL = 800.0  # pixels


def compute_iou(box_a: BBoxModel, box_b: BBoxModel) -> float:
    """
    Compute Intersection over Union (IoU) of two bounding boxes.

    Returns a value in [0, 1].  0 if boxes do not overlap.
    """
    ix1 = max(box_a.x1, box_b.x1)
    iy1 = max(box_a.y1, box_b.y1)
    ix2 = min(box_a.x2, box_b.x2)
    iy2 = min(box_a.y2, box_b.y2)

    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0

    intersection = (ix2 - ix1) * (iy2 - iy1)
    union = box_a.area + box_b.area - intersection

    if union <= 0.0:
        return 0.0

    return float(intersection / union)


def compute_center_distance(
    obs_a: TrackObservation,
    obs_b: TrackObservation,
) -> float:
    """Euclidean distance between the centres of two observations."""
    dx = obs_a.center_x - obs_b.center_x
    dy = obs_a.center_y - obs_b.center_y
    return math.sqrt(dx * dx + dy * dy)


def compute_proximity_score(
    obs_a: TrackObservation,
    obs_b: TrackObservation,
    iou: float,
    frame_diagonal: float = _DEFAULT_DIAGONAL,
) -> float:
    """
    Compute a proximity score in [0, 1] combining normalised distance and IoU.

    Higher score → objects are closer / overlapping.
    """
    distance = compute_center_distance(obs_a, obs_b)

    # Normalise distance: score = 1 when distance=0, ~0 when distance≥diagonal
    if frame_diagonal <= 0.0:
        frame_diagonal = _DEFAULT_DIAGONAL

    dist_score = max(0.0, 1.0 - distance / frame_diagonal)

    # Combine: 60% distance-based, 40% overlap-based
    proximity = 0.6 * dist_score + 0.4 * iou

    return float(min(1.0, max(0.0, proximity)))


@dataclass
class _EvidenceFrame:
    """Single frame of collision evidence."""
    timestamp: float
    proximity: float
    speed_change_a: float
    speed_change_b: float
    direction_change_a: float
    direction_change_b: float
    iou: float


class CollisionEvidenceBuffer:
    """
    Accumulates evidence frames for a (camera_id, track_id_a, track_id_b) pair.

    Evidence is scored and can be queried for confirmation once enough
    frames have been collected within a time window.
    """

    def __init__(self) -> None:
        self._frames: List[_EvidenceFrame] = []

    def add_evidence(
        self,
        timestamp: float,
        proximity: float,
        speed_change_a: float,
        speed_change_b: float,
        direction_change_a: float,
        direction_change_b: float,
        iou: float,
    ) -> None:
        """Append one frame of evidence."""
        self._frames.append(
            _EvidenceFrame(
                timestamp=timestamp,
                proximity=proximity,
                speed_change_a=speed_change_a,
                speed_change_b=speed_change_b,
                direction_change_a=direction_change_a,
                direction_change_b=direction_change_b,
                iou=iou,
            )
        )

    def compute_score(self) -> dict:
        """
        Compute collision likelihood scores from accumulated evidence.

        Score formula:
            score = (
                0.25 * proximity_score +
                0.20 * overlap_score +
                0.25 * speed_change_score +
                0.15 * direction_change_score +
                0.15 * post_stop_score
            )

        Returns a dict with all sub-scores and the final score.
        """
        if not self._frames:
            return {
                "proximity_score": 0.0,
                "overlap_score": 0.0,
                "speed_change_score": 0.0,
                "direction_change_score": 0.0,
                "post_stop_score": 0.0,
                "final_score": 0.0,
                "evidence_count": 0,
            }

        n = len(self._frames)

        # ── Proximity: max proximity across frames ────────────────────────
        proximity_score = max(f.proximity for f in self._frames)

        # ── Overlap: max IoU across frames ────────────────────────────────
        overlap_score = max(f.iou for f in self._frames)

        # ── Speed change: normalised max absolute speed change ────────────
        max_speed_change = max(
            max(f.speed_change_a, f.speed_change_b) for f in self._frames
        )
        # Normalise by 50 px/s (a hard stop from 50 px/s → score = 1.0)
        speed_change_score = min(1.0, max_speed_change / 50.0)

        # ── Direction change: normalised max direction change ─────────────
        max_dir_change = max(
            max(f.direction_change_a, f.direction_change_b) for f in self._frames
        )
        # 180° change → score = 1.0
        direction_change_score = min(1.0, max_dir_change / 180.0)

        # ── Post-stop: fraction of frames where both objects nearly stopped ─
        # Use speed_change close to original speed (proxy: high speed change)
        # Simple heuristic: evidence frames where speed_change > threshold
        post_stop_frames = sum(
            1 for f in self._frames
            if f.speed_change_a > 2.0 and f.speed_change_b > 2.0
        )
        post_stop_score = min(1.0, post_stop_frames / max(n, 1))

        final_score = (
            0.25 * proximity_score
            + 0.20 * overlap_score
            + 0.25 * speed_change_score
            + 0.15 * direction_change_score
            + 0.15 * post_stop_score
        )

        return {
            "proximity_score": round(proximity_score, 4),
            "overlap_score": round(overlap_score, 4),
            "speed_change_score": round(speed_change_score, 4),
            "direction_change_score": round(direction_change_score, 4),
            "post_stop_score": round(post_stop_score, 4),
            "final_score": round(min(1.0, max(0.0, final_score)), 4),
            "evidence_count": n,
        }

    def is_confirmed(
        self,
        min_frames: int,
        window_seconds: float,
    ) -> bool:
        """
        Return True if there are at least `min_frames` evidence frames
        within the last `window_seconds`.
        """
        if len(self._frames) < min_frames:
            return False

        latest_ts = self._frames[-1].timestamp
        recent_frames = [
            f for f in self._frames
            if (latest_ts - f.timestamp) <= window_seconds
        ]
        return len(recent_frames) >= min_frames

    def clear(self) -> None:
        """Remove all accumulated evidence."""
        self._frames.clear()
