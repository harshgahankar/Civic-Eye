"""
app/ai/inference.py

Thin facade that exposes a single InferenceEngine used by the pipeline.

The engine holds the ByteTracker instance and delegates to it, exposing
a clean interface that pipeline code can call without knowing Ultralytics
internals.
"""

from __future__ import annotations

import numpy as np

from app.ai.tracker import ByteTracker, TrackedObject
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class InferenceEngine:
    """
    Wraps ByteTracker and exposes a simple per-frame API used by the pipeline.

    One InferenceEngine instance is created per video-processing job.
    Reusing a single instance across frames is what enables ByteTrack
    to maintain stable object identities.
    """

    def __init__(
        self,
        model_name: str | None = None,
        confidence: float | None = None,
        iou: float | None = None,
        device: str | None = None,
        image_size: int | None = None,
        tracker_config: str | None = None,
    ) -> None:
        self._tracker = ByteTracker(
            model_name=model_name or settings.YOLO_MODEL,
            confidence=confidence or settings.AI_CONFIDENCE_THRESHOLD,
            iou=iou or settings.AI_IOU_THRESHOLD,
            device=device or settings.AI_DEVICE,
            image_size=image_size or settings.AI_IMAGE_SIZE,
            tracker_config=tracker_config or settings.TRACKER_CONFIG,
        )

    def process_frame(self, frame: np.ndarray) -> list[TrackedObject]:
        """
        Run detect+track on a single BGR frame.
        Returns a list of TrackedObject, possibly empty.
        """
        return self._tracker.track(frame)

    def reset(self) -> None:
        """Reset tracker state (call between videos)."""
        self._tracker.reset()
