"""
app/behavior/stationary.py

Detects stationary/abandoned objects by tracking displacement over time.
"""
from __future__ import annotations

import math

from app.schemas.behavior import TrackObservation


def is_stationary(
    history: list[TrackObservation],
    movement_threshold: float,
    min_duration: float,
) -> tuple[bool, float, list[str]]:
    """
    Determine if a tracked object has been stationary for a minimum duration.

    Parameters
    ----------
    history            : list[TrackObservation]  Chronological observations.
    movement_threshold : float  Max pixel displacement to count as "stationary".
    min_duration       : float  Minimum seconds the object must have been still.

    Returns
    -------
    (is_stationary, duration_seconds, reasons)
    """
    reasons: list[str] = []

    if len(history) < 2:
        return False, 0.0, reasons

    first = history[0]
    last = history[-1]

    dx = last.center_x - first.center_x
    dy = last.center_y - first.center_y
    displacement = math.sqrt(dx * dx + dy * dy)
    duration = last.timestamp - first.timestamp

    still = displacement < movement_threshold
    long_enough = duration >= min_duration

    if still and long_enough:
        reasons.append(
            f"object stationary: displacement={displacement:.1f}px over {duration:.1f}s"
        )
        return True, duration, reasons

    # Provide diagnostic reasons even when not triggered
    if not still:
        reasons.append(
            f"object moving: displacement={displacement:.1f}px "
            f"(threshold={movement_threshold:.1f}px)"
        )
    if not long_enough:
        reasons.append(
            f"duration too short: {duration:.1f}s < {min_duration:.1f}s"
        )

    return False, duration, reasons
