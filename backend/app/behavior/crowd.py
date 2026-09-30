"""
app/behavior/crowd.py

Crowd density and movement anomaly detection.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass
from typing import Counter, Dict, List, Optional, Tuple

from app.schemas.behavior import KinematicState, TrackObservation


@dataclass
class CrowdStats:
    """Aggregate statistics for persons in a frame or ROI."""

    person_count: int
    relative_density: float       # persons per (frame_area / 10_000) pixels²
    average_speed: float          # pixels/sec
    speed_variance: float         # pixels/sec²
    dominant_direction: str       # most common direction label
    direction_dispersion: float   # fraction NOT moving in dominant direction [0, 1]


def _filter_by_roi(
    observations: list[TrackObservation],
    roi: tuple[float, float, float, float] | None,
) -> list[int]:
    """Return indices of observations that fall within the ROI (if any)."""
    if roi is None:
        return list(range(len(observations)))
    x1, y1, x2, y2 = roi
    return [
        i
        for i, obs in enumerate(observations)
        if x1 <= obs.center_x <= x2 and y1 <= obs.center_y <= y2
    ]


def compute_crowd_stats(
    person_observations: list[TrackObservation],
    person_kinematics: list[KinematicState],
    frame_width: int,
    frame_height: int,
    roi: Optional[tuple] = None,  # (x1, y1, x2, y2) or None
) -> CrowdStats:
    """
    Compute crowd statistics from person observations and their kinematics.

    Parameters
    ----------
    person_observations : list of current-frame observations for persons
    person_kinematics   : matching list of KinematicState (same order)
    frame_width         : int
    frame_height        : int
    roi                 : optional bounding box to restrict the analysis area

    Returns
    -------
    CrowdStats
    """
    # Guard: align lists
    n = min(len(person_observations), len(person_kinematics))
    obs = person_observations[:n]
    kins = person_kinematics[:n]

    # Filter by ROI
    valid_indices = _filter_by_roi(obs, roi)
    obs = [obs[i] for i in valid_indices]
    kins = [kins[i] for i in valid_indices]

    person_count = len(obs)

    # ── Relative density ──────────────────────────────────────────────────
    frame_area = float(frame_width * frame_height)
    if frame_area > 0:
        relative_density = person_count / (frame_area / 10_000.0)
    else:
        relative_density = 0.0

    # ── Speed stats ───────────────────────────────────────────────────────
    if person_count == 0:
        return CrowdStats(
            person_count=0,
            relative_density=0.0,
            average_speed=0.0,
            speed_variance=0.0,
            dominant_direction="STATIONARY",
            direction_dispersion=0.0,
        )

    speeds = [k.speed for k in kins]
    average_speed = sum(speeds) / person_count

    if person_count > 1:
        speed_variance = statistics.variance(speeds)
    else:
        speed_variance = 0.0

    # ── Direction stats ───────────────────────────────────────────────────
    directions = [k.direction_label for k in kins]
    direction_counts: Dict[str, int] = {}
    for d in directions:
        direction_counts[d] = direction_counts.get(d, 0) + 1

    dominant_direction = max(direction_counts, key=lambda k: direction_counts[k])
    dominant_count = direction_counts[dominant_direction]

    # Dispersion: fraction NOT in dominant direction
    direction_dispersion = 1.0 - (dominant_count / person_count)

    return CrowdStats(
        person_count=person_count,
        relative_density=round(relative_density, 4),
        average_speed=round(average_speed, 4),
        speed_variance=round(speed_variance, 4),
        dominant_direction=dominant_direction,
        direction_dispersion=round(direction_dispersion, 4),
    )


def detect_crowd_anomaly(
    current: CrowdStats,
    previous: Optional[CrowdStats],
    count_change_threshold: float = 0.3,
    speed_change_threshold: float = 2.0,
    dispersion_threshold: float = 0.6,
) -> tuple[bool, float, list[str]]:
    """
    Detect anomalies in crowd movement compared to previous state.

    Checks:
    1. Sudden change in person count (>count_change_threshold fraction)
    2. Sudden change in average speed (>speed_change_threshold px/s)
    3. High direction dispersion (>dispersion_threshold)

    Returns
    -------
    (triggered, confidence, reasons)
    """
    reasons: list[str] = []
    triggered = False
    confidence = 0.0

    # Minimum crowd size to trigger anomaly
    if current.person_count < 3:
        return False, 0.0, reasons

    # ── Direction dispersion ──────────────────────────────────────────────
    if current.direction_dispersion >= dispersion_threshold:
        triggered = True
        conf_contribution = current.direction_dispersion
        confidence = max(confidence, conf_contribution)
        reasons.append(
            f"high direction dispersion: {current.direction_dispersion:.2f} "
            f"(threshold={dispersion_threshold:.2f})"
        )

    # ── Count change ──────────────────────────────────────────────────────
    if previous is not None and previous.person_count > 0:
        count_change = abs(current.person_count - previous.person_count)
        relative_change = count_change / previous.person_count
        if relative_change >= count_change_threshold:
            triggered = True
            conf_contribution = min(1.0, relative_change)
            confidence = max(confidence, conf_contribution)
            reasons.append(
                f"sudden crowd count change: {previous.person_count} → "
                f"{current.person_count} ({relative_change:.1%})"
            )

        # ── Speed change ──────────────────────────────────────────────────
        speed_delta = abs(current.average_speed - previous.average_speed)
        if speed_delta >= speed_change_threshold:
            triggered = True
            conf_contribution = min(1.0, speed_delta / (speed_change_threshold * 5))
            confidence = max(confidence, conf_contribution)
            reasons.append(
                f"sudden speed change: {previous.average_speed:.1f} → "
                f"{current.average_speed:.1f} px/s (delta={speed_delta:.1f})"
            )

    return triggered, round(min(1.0, max(0.0, confidence)), 4), reasons
