"""
app/behavior/trajectory.py

Trajectory anomaly detection: sharp turns, reversals, and zigzag patterns.
"""
from __future__ import annotations

import math
from typing import List, Tuple

from app.schemas.behavior import KinematicState, TrackObservation


def _mean_direction(observations: list[TrackObservation]) -> float | None:
    """
    Compute the mean direction angle (degrees) over a sequence of observations.
    Returns None if fewer than 2 observations or no valid displacement.
    """
    if len(observations) < 2:
        return None

    dx_total = observations[-1].center_x - observations[0].center_x
    dy_total = observations[-1].center_y - observations[0].center_y

    if abs(dx_total) < 1e-9 and abs(dy_total) < 1e-9:
        return None

    # Negative dy because screen y increases downward
    angle = math.degrees(math.atan2(-dy_total, dx_total)) % 360.0
    return angle


def _angular_difference(a: float, b: float) -> float:
    """
    Minimum angular difference between two angles in degrees.
    Result is in [0, 180].
    """
    diff = abs(a - b) % 360.0
    if diff > 180.0:
        diff = 360.0 - diff
    return diff


def compute_direction_change(
    history: list[TrackObservation],
) -> tuple[float, str]:
    """
    Compare direction in first half vs second half of history.

    Returns
    -------
    (angle_change_degrees, description)
    - 0–30°  : "straight"
    - 30–90° : "moderate_turn"
    - 90–150°: "sharp_turn"
    - >150°  : "reversal"
    """
    if len(history) < 4:
        return 0.0, "insufficient_data"

    mid = len(history) // 2
    first_half = history[:mid]
    second_half = history[mid:]

    angle_first = _mean_direction(first_half)
    angle_second = _mean_direction(second_half)

    if angle_first is None or angle_second is None:
        return 0.0, "stationary"

    change = _angular_difference(angle_first, angle_second)

    if change <= 30.0:
        desc = "straight"
    elif change <= 90.0:
        desc = "moderate_turn"
    elif change <= 150.0:
        desc = "sharp_turn"
    else:
        desc = "reversal"

    return change, desc


def detect_trajectory_anomaly(
    history: list[TrackObservation],
    kinematics: KinematicState,
    direction_change_threshold: float = 90.0,
) -> tuple[bool, float, list[str]]:
    """
    Detect trajectory anomalies: sharp turns, reversals, and zigzag motion.

    Requirements: >= 6 observations.

    Returns
    -------
    (triggered, confidence, reasons)
    """
    reasons: list[str] = []

    if len(history) < 6:
        return False, 0.0, reasons

    angle_change, description = compute_direction_change(history)

    triggered = False
    confidence = 0.0

    # ── Sharp turn ────────────────────────────────────────────────────────
    if description == "reversal":
        triggered = True
        confidence = min(1.0, 0.6 + (angle_change - 150.0) / 100.0)
        reasons.append(f"reversal detected: direction changed {angle_change:.1f}°")

    elif description == "sharp_turn" and angle_change >= direction_change_threshold:
        triggered = True
        confidence = min(1.0, 0.4 + (angle_change - 90.0) / 120.0)
        reasons.append(f"sharp turn detected: direction changed {angle_change:.1f}°")

    # ── Zigzag detection: check alternating direction changes ─────────────
    if len(history) >= 8 and not triggered:
        # Split into 4 quarters and compare alternating directions
        q = len(history) // 4
        segments = [
            history[0:q],
            history[q:2*q],
            history[2*q:3*q],
            history[3*q:],
        ]
        seg_directions = [_mean_direction(s) for s in segments]
        valid_dirs = [d for d in seg_directions if d is not None]

        if len(valid_dirs) >= 3:
            changes = [
                _angular_difference(valid_dirs[i], valid_dirs[i + 1])
                for i in range(len(valid_dirs) - 1)
            ]
            # Zigzag: alternating large/small or large/large changes
            if len(changes) >= 2:
                # Check if we have at least 2 direction changes > 45°
                large_changes = sum(1 for c in changes if c > 45.0)
                if large_changes >= 2:
                    triggered = True
                    avg_change = sum(changes) / len(changes)
                    confidence = min(1.0, 0.3 + avg_change / 360.0)
                    reasons.append(
                        f"zigzag motion: {large_changes} direction reversals "
                        f"(avg {avg_change:.1f}° change)"
                    )

    return triggered, confidence, reasons
