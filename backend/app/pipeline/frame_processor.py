"""
app/pipeline/frame_processor.py

Connects a raw video frame to the InferenceEngine and converts the
TrackedObject results into DetectionEvent objects.

Perception filtering lives here (single choke point, so annotations,
behavior and incidents all see the same cleaned stream):

1. Class whitelist  (AI_ALLOWED_CLASSES, empty = allow all)
2. Minimum track age (AI_MIN_TRACK_AGE consecutive frames before emission —
   kills single-frame flicker ghosts)

This module deals only with perception and tracking.
No accident/crowd/baggage logic belongs here.
"""

from __future__ import annotations

import numpy as np

from app.ai.inference import InferenceEngine
from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.detection import DetectionEvent

logger = get_logger(__name__)

# Drop per-track age counters not seen for this many frames (memory bound).
_STALE_AFTER_FRAMES = 30


def parse_allowed_classes(raw: str | None) -> set[str] | None:
    """Parse AI_ALLOWED_CLASSES. None = allow every class."""
    if raw is None:
        return None
    names = {part.strip().lower() for part in raw.split(",") if part.strip()}
    return names or None


def parse_class_confidence(raw: str | None) -> dict[str, float]:
    """Parse AI_CLASS_CONFIDENCE ("cls:thr,...") → {class: threshold}."""
    out: dict[str, float] = {}
    if not raw:
        return out
    for part in raw.split(","):
        part = part.strip()
        if ":" not in part:
            continue
        name, value = part.split(":", 1)
        try:
            threshold = float(value)
        except ValueError:
            continue
        if name.strip() and 0.0 < threshold <= 1.0:
            out[name.strip().lower()] = threshold
    return out


def parse_class_aliases(raw: str | None) -> dict[str, str]:
    """Parse AI_CLASS_ALIASES ("from:to,...") → {sub-label: generic}."""
    out: dict[str, str] = {}
    if not raw:
        return out
    for part in raw.split(","):
        part = part.strip()
        if ":" not in part:
            continue
        src, dst = part.split(":", 1)
        if src.strip() and dst.strip():
            out[src.strip().lower()] = dst.strip()
    return out


def effective_model_confidence(
    global_threshold: float, overrides: dict[str, float]
) -> float:
    """Model-level threshold must be the minimum so per-class bars can be
    enforced downstream (a higher model bar would erase low-bar classes)."""
    if not overrides:
        return global_threshold
    return min(global_threshold, min(overrides.values()))


class FrameProcessor:
    """
    Wraps an InferenceEngine and provides a clean per-frame API.

    Parameters
    ----------
    engine : InferenceEngine
        A shared InferenceEngine instance (one per processing job).
    allowed_classes : set[str] | None
        Lower-cased class whitelist. None = allow all. Defaults to the
        AI_ALLOWED_CLASSES setting.
    min_track_age : int
        Consecutive frames a track must survive before emission.
        Defaults to the AI_MIN_TRACK_AGE setting.
    """

    def __init__(
        self,
        engine: InferenceEngine,
        allowed_classes: set[str] | None = None,
        min_track_age: int | None = None,
        class_confidence: dict[str, float] | None = None,
    ) -> None:
        self._engine = engine
        if allowed_classes is None:
            # Default: follow the AI_ALLOWED_CLASSES setting.
            self._allowed = parse_allowed_classes(settings.AI_ALLOWED_CLASSES)
        elif len(allowed_classes) == 0:
            self._allowed = None  # explicit empty set = allow all
        else:
            self._allowed = {c.lower() for c in allowed_classes}
        self._class_conf = (
            class_confidence if class_confidence is not None
            else parse_class_confidence(settings.AI_CLASS_CONFIDENCE)
        )
        self._aliases = parse_class_aliases(settings.AI_CLASS_ALIASES)
        self._min_age = (
            min_track_age if min_track_age is not None
            else max(1, settings.AI_MIN_TRACK_AGE)
        )
        # {(camera_id, track_id): [consecutive_count, last_frame_number]}
        self._age: dict[tuple[str, int], list[int]] = {}

    def process_frame(
        self,
        frame: np.ndarray,
        camera_id: str,
        frame_number: int,
        timestamp: float,
    ) -> list[DetectionEvent]:
        """
        Detect and track objects in a single frame.

        Parameters
        ----------
        frame        : np.ndarray  BGR frame from OpenCV
        camera_id    : str         logical camera identifier
        frame_number : int         0-based frame index
        timestamp    : float       frame timestamp in seconds (frame_idx / fps)

        Returns
        -------
        List[DetectionEvent]
            One DetectionEvent per mature, allowed tracked object.
            Empty list if nothing qualifies.
        """
        tracked_objects = self._engine.process_frame(frame)

        seen: set[tuple[str, int]] = set()
        events: list[DetectionEvent] = []
        for obj in tracked_objects:
            cls = obj.class_name.lower()
            if self._allowed is not None and cls not in self._allowed:
                continue  # 1. class whitelist
            floor = self._class_conf.get(cls, settings.AI_CONFIDENCE_THRESHOLD)
            if obj.confidence < floor:
                continue  # 2. per-class confidence bar
            key = (camera_id, obj.track_id)
            seen.add(key)
            entry = self._age.get(key)
            if entry is None:
                self._age[key] = [1, frame_number]
                count = 1
            elif frame_number - entry[1] > _STALE_AFTER_FRAMES:
                # Track ID reused after a long gap → treat as new.
                self._age[key] = [1, frame_number]
                count = 1
            else:
                entry[0] += 1
                entry[1] = frame_number
                count = entry[0]
            if count < self._min_age:
                continue  # 2. track too young (flicker suppression)
            display_name = self._aliases.get(cls, obj.class_name)
            events.append(
                DetectionEvent(
                    event_type="OBJECT_TRACKED",
                    camera_id=camera_id,
                    frame_number=frame_number,
                    timestamp=round(timestamp, 4),
                    track_id=obj.track_id,
                    class_id=obj.class_id,
                    class_name=display_name,
                    confidence=obj.confidence,
                    bbox=obj.bbox,
                )
            )

        # Prune stale counters (bounded memory).
        if len(self._age) > 4 * max(len(seen), 1):
            self._age = {
                key: val for key, val in self._age.items()
                if frame_number - val[1] <= _STALE_AFTER_FRAMES
            }
        return events

    def reset(self) -> None:
        """Clear track-age state (call between videos)."""
        self._age.clear()
