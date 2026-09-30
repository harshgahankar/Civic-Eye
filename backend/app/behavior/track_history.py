"""
app/behavior/track_history.py

Manages per-track observation history for all cameras.
Uses collections.deque for O(1) appends and automatic capping.
"""
from __future__ import annotations

from collections import defaultdict, deque
from typing import Dict, List, Tuple

from app.core.config import settings
from app.schemas.behavior import TrackObservation


class TrackHistory:
    """
    Stores TrackObservation objects per (camera_id, track_id).

    Features:
    - Caps history at TRACK_HISTORY_SIZE (deque maxlen)
    - Expires tracks not seen for TRACK_TIMEOUT_SECONDS
    - Thread-safe for single-threaded pipeline use
    """

    def __init__(
        self,
        max_history: int | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self._max_history = max_history or settings.TRACK_HISTORY_SIZE
        self._timeout = timeout_seconds or settings.TRACK_TIMEOUT_SECONDS

        # {(camera_id, track_id): deque[TrackObservation]}
        self._histories: Dict[Tuple[str, int], deque] = {}
        # {(camera_id, track_id): last_seen_timestamp}
        self._last_seen: Dict[Tuple[str, int], float] = {}

    # ── Public API ────────────────────────────────────────────────────────

    def update(self, camera_id: str, track_id: int, observation: TrackObservation) -> None:
        """Add a new observation for this (camera_id, track_id)."""
        key = (camera_id, track_id)
        if key not in self._histories:
            self._histories[key] = deque(maxlen=self._max_history)
        self._histories[key].append(observation)
        self._last_seen[key] = observation.timestamp

    def get_history(self, camera_id: str, track_id: int) -> list[TrackObservation]:
        """Return list of observations (oldest first). Empty list if unknown."""
        key = (camera_id, track_id)
        history = self._histories.get(key)
        if history is None:
            return []
        return list(history)

    def get_active_tracks(self, camera_id: str) -> list[int]:
        """Return list of track_ids currently held for this camera."""
        return [
            track_id
            for (cam_id, track_id) in self._histories
            if cam_id == camera_id
        ]

    def cleanup(self, current_timestamp: float) -> int:
        """
        Remove tracks not seen within the timeout window.

        Returns the number of tracks removed.
        """
        stale = [
            key
            for key, last_ts in self._last_seen.items()
            if (current_timestamp - last_ts) > self._timeout
        ]
        for key in stale:
            self._histories.pop(key, None)
            self._last_seen.pop(key, None)
        return len(stale)

    def reset(self) -> None:
        """Clear all history."""
        self._histories.clear()
        self._last_seen.clear()
