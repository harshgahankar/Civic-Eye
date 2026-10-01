"""
app/behavior/kinematics.py

Computes kinematic features (speed, acceleration, direction) from track history.
All speeds are in pixels/second; accelerations in pixels/second².
"""
from __future__ import annotations

import math
from typing import List, Tuple

from app.schemas.behavior import KinematicState, TrackObservation

# Direction lookup: (upper_angle_bound, label)
# Angles are normalised to [0, 360) before lookup.
DIRECTION_LABELS: list[tuple[float, str]] = [
    (22.5,  "EAST"),
    (67.5,  "NORTH_EAST"),
    (112.5, "NORTH"),
    (157.5, "NORTH_WEST"),
    (202.5, "WEST"),
    (247.5, "SOUTH_WEST"),
    (292.5, "SOUTH"),
    (337.5, "SOUTH_EAST"),
    (360.0, "EAST"),
]

_STATIONARY_SPEED_THRESHOLD = 0.5  # pixels/sec — below this → STATIONARY


def _angle_to_direction(angle_deg: float) -> str:
    """Map a bearing angle [0, 360) to a compass label."""
    normalised = angle_deg % 360.0
    for upper, label in DIRECTION_LABELS:
        if normalised <= upper:
            return label
    return "EAST"


def compute_kinematics(
    history: list[TrackObservation],
    alpha: float = 0.4,
) -> KinematicState:
    """
    Derive kinematic state from a sequence of TrackObservations.

    Parameters
    ----------
    history : list[TrackObservation]
        Observations in chronological order.  Requires ≥ 2 items.
    alpha   : float
        EMA smoothing factor (0 < alpha ≤ 1).  Higher = more reactive.

    Returns
    -------
    KinematicState
        Zero-state (speed=0, label=STATIONARY) if < 2 observations.
    """
    if len(history) < 2:
        return KinematicState()

    # ── Compute per-step instantaneous speeds and velocity components ─────
    raw_speeds: list[float] = []
    raw_vx: list[float] = []
    raw_vy: list[float] = []

    for i in range(1, len(history)):
        prev = history[i - 1]
        curr = history[i]
        dt = curr.timestamp - prev.timestamp
        if dt <= 0.0:
            continue  # skip degenerate / same-timestamp pairs

        dx = curr.center_x - prev.center_x
        dy = curr.center_y - prev.center_y
        speed_inst = math.sqrt(dx * dx + dy * dy) / dt
        raw_speeds.append(speed_inst)
        raw_vx.append(dx / dt)
        raw_vy.append(dy / dt)

    if not raw_speeds:
        return KinematicState()

    # ── EMA smoothing ─────────────────────────────────────────────────────
    smoothed_speed = raw_speeds[0]
    smoothed_vx = raw_vx[0]
    smoothed_vy = raw_vy[0]

    for s, vx, vy in zip(raw_speeds[1:], raw_vx[1:], raw_vy[1:]):
        smoothed_speed = alpha * s + (1.0 - alpha) * smoothed_speed
        smoothed_vx = alpha * vx + (1.0 - alpha) * smoothed_vx
        smoothed_vy = alpha * vy + (1.0 - alpha) * smoothed_vy

    # ── Acceleration: EMA over sequential smoothed speed differences ──────
    if len(raw_speeds) >= 2:
        # compute per-step acceleration from raw_speeds and dt
        accel_samples: list[float] = []
        for i in range(1, len(history)):
            prev = history[i - 1]
            curr = history[i]
            dt = curr.timestamp - prev.timestamp
            if dt <= 0.0:
                continue
            # approximate: speed difference / dt
            if len(accel_samples) == 0 and len(raw_speeds) >= 2:
                # build accel samples from smoothed list
                break

        # Simpler: compute acceleration directly from raw_speeds differences
        accel_list: list[float] = []
        speed_iter = list(raw_speeds)
        # get dt between pairs that contributed to raw_speeds
        dt_list: list[float] = []
        for i in range(1, len(history)):
            dt = history[i].timestamp - history[i - 1].timestamp
            if dt > 0.0:
                dt_list.append(dt)

        for i in range(1, len(speed_iter)):
            if i - 1 < len(dt_list) and dt_list[i - 1] > 0:
                accel_list.append(
                    (speed_iter[i] - speed_iter[i - 1]) / dt_list[i - 1]
                )

        if accel_list:
            smoothed_accel = accel_list[0]
            for a in accel_list[1:]:
                smoothed_accel = alpha * a + (1.0 - alpha) * smoothed_accel
        else:
            smoothed_accel = 0.0
    else:
        smoothed_accel = 0.0

    # ── Direction ─────────────────────────────────────────────────────────
    # atan2(-dy, dx): negative dy because screen y increases downward
    direction_angle = math.degrees(math.atan2(-smoothed_vy, smoothed_vx)) % 360.0

    if smoothed_speed < _STATIONARY_SPEED_THRESHOLD:
        direction_label = "STATIONARY"
    else:
        direction_label = _angle_to_direction(direction_angle)

    return KinematicState(
        speed=max(0.0, smoothed_speed),
        vx=smoothed_vx,
        vy=smoothed_vy,
        acceleration=smoothed_accel,
        direction_angle=direction_angle,
        direction_label=direction_label,
    )


def detect_sudden_stop(
    history: list[TrackObservation],
    kinematics: KinematicState,
    moving_threshold: float,
    stopped_threshold: float,
    decel_threshold: float,
    relative_fraction: float = 0.25,
    window_seconds: float = 0.6,
) -> tuple[bool, list[str]]:
    """
    Detect a sudden stop event for a single track.

    Requirements:
    - At least 4 observations
    - Was previously moving (any of last-4 instantaneous speeds > moving_threshold)
    - Currently stopped: smoothed speed below BOTH the absolute
      ``stopped_threshold`` floor AND ``relative_fraction`` of the recent
      peak speed. The relative arm is what makes this jitter-robust: after
      a real crash a car doing 200 px/s drops to ~15 px/s of box wobble —
      never below an absolute 1 px/s floor, but unmistakably stopped
      relative to its own pre-impact speed. A parked car jiggling at a
      steady 15 px/s fails the relative arm (15 > 0.25 * 15 peak).
    - Deceleration magnitude > decel_threshold

    Returns
    -------
    (triggered, reasons)
    """
    reasons: list[str] = []

    if len(history) < 4:
        return False, reasons

    # Compute instantaneous speeds for the last 4 steps
    recent = history[-5:]  # up to 5 obs → up to 4 steps
    recent_speeds: list[float] = []
    for i in range(1, len(recent)):
        prev = recent[i - 1]
        curr = recent[i]
        dt = curr.timestamp - prev.timestamp
        if dt <= 0.0:
            continue
        dx = curr.center_x - prev.center_x
        dy = curr.center_y - prev.center_y
        recent_speeds.append(math.sqrt(dx * dx + dy * dy) / dt)

    if not recent_speeds:
        return False, reasons

    peak_recent = max(recent_speeds)
    was_moving = any(s > moving_threshold for s in recent_speeds[:-1] or recent_speeds)

    # ── Range-based stop: compares how far the box roamed in the last
    # ~0.6 s vs. an older reference window (up to ~3 s back). A crashed car
    # collapses from tens of pixels of travel to a few pixels of box
    # jitter; a parked car jitters the same in both windows, so the ratio
    # rejects it. Speed levels alone cannot do this: 1–2 px of detector
    # wobble at 30 fps already reads as 30–60 px/s.
    def _range(obs: list[TrackObservation]) -> float:
        if len(obs) < 2:
            return 0.0
        xs = [o.center_x for o in obs]
        ys = [o.center_y for o in obs]
        return math.hypot(max(xs) - min(xs), max(ys) - min(ys))

    t_now = history[-1].timestamp
    recent_obs = [o for o in history if t_now - o.timestamp <= window_seconds]
    older_obs = [o for o in history if t_now - o.timestamp > window_seconds]
    is_stopped = False
    if len(older_obs) >= 2:
        ref_range = _range(older_obs)
        recent_range = _range(recent_obs)
        # Mean speed over the reference window: an oscillating box (ID
        # fighting between two detections) roams little but its
        # instantaneous speeds stay huge — the range arm alone calls that
        # "stopped". Both arms must agree.
        older_speeds: list[float] = []
        for i in range(1, len(history)):
            prev, curr = history[i - 1], history[i]
            if curr.timestamp > t_now - window_seconds:
                continue
            dt = curr.timestamp - prev.timestamp
            if dt <= 0.0:
                continue
            dx = curr.center_x - prev.center_x
            dy = curr.center_y - prev.center_y
            older_speeds.append(math.hypot(dx, dy) / dt)
        ref_mean_speed = (
            sum(older_speeds) / len(older_speeds) if older_speeds else 0.0
        )
        if ref_range > moving_threshold * window_seconds:
            was_moving = True
            range_collapsed = recent_range < max(
                stopped_threshold * window_seconds, 0.2 * ref_range
            )
            speed_collapsed = kinematics.speed < max(
                stopped_threshold, 0.4 * ref_mean_speed
            )
            is_stopped = range_collapsed and speed_collapsed
    if not is_stopped:
        # Fallback for short histories: stop level adapts to how fast the
        # track was going, tolerating residual box jitter after impact.
        stop_level = max(stopped_threshold, relative_fraction * peak_recent)
        is_stopped = kinematics.speed < stop_level
    high_decel = abs(kinematics.acceleration) > decel_threshold

    if was_moving and is_stopped and high_decel:
        reasons.append(
            f"was moving (max_speed={max(recent_speeds):.1f} px/s), "
            f"now stopped (speed={kinematics.speed:.1f} px/s)"
        )
        reasons.append(
            f"rapid deceleration: {kinematics.acceleration:.1f} px/s²"
        )
        return True, reasons

    return False, reasons


def detect_rapid_slowdown(
    history: list[TrackObservation],
    kinematics: KinematicState,
    moving_threshold: float,
    decel_threshold: float,
    slow_fraction: float = 0.4,
) -> tuple[bool, list[str]]:
    """Detect a sharp speed collapse that does NOT reach a full stop.

    Bump-and-roll crashes (cars collide then keep rolling) never satisfy
    ``detect_sudden_stop`` — yet their speed trace shows an unmistakable
    cliff plus a hard deceleration spike. This detector catches that:
      - ≥4 observations, was moving (peak recent speed > moving_threshold),
      - current smoothed speed < slow_fraction of that peak,
      - |acceleration| > decel_threshold.

    Returns (triggered, reasons).
    """
    reasons: list[str] = []

    if len(history) < 4:
        return False, reasons

    recent = history[-5:]
    recent_speeds: list[float] = []
    for i in range(1, len(recent)):
        prev = recent[i - 1]
        curr = recent[i]
        dt = curr.timestamp - prev.timestamp
        if dt <= 0.0:
            continue
        dx = curr.center_x - prev.center_x
        dy = curr.center_y - prev.center_y
        recent_speeds.append(math.sqrt(dx * dx + dy * dy) / dt)

    if not recent_speeds:
        return False, reasons

    peak = max(recent_speeds)
    if peak <= moving_threshold:
        return False, reasons

    collapsed = kinematics.speed < slow_fraction * peak
    high_decel = abs(kinematics.acceleration) > decel_threshold

    if collapsed and high_decel:
        reasons.append(
            f"was moving (peak_speed={peak:.1f} px/s), "
            f"now much slower (speed={kinematics.speed:.1f} px/s)"
        )
        reasons.append(
            f"sharp deceleration: {kinematics.acceleration:.1f} px/s²"
        )
        return True, reasons

    return False, reasons
