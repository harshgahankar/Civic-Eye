"""
app/pipeline/frame_processor.py

Connects a raw video frame to the InferenceEngine and converts the
TrackedObject results into DetectionEvent objects.

This module deals only with perception and tracking.
No accident/crowd/baggage logic belongs here.
"""

from __future__ import annotations

import numpy as np

from app.ai.inference import InferenceEngine
from app.core.logging import get_logger
from app.schemas.detection import DetectionEvent

logger = get_logger(__name__)


class FrameProcessor:
    """
    Wraps an InferenceEngine and provides a clean per-frame API.

    Parameters
    ----------
    engine : InferenceEngine
        A shared InferenceEngine instance (one per processing job).
    """

    def __init__(self, engine: InferenceEngine) -> None:
        self._engine = engine

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
            One DetectionEvent per tracked object in this frame.
            Empty list if no objects detected or tracked.
        """
        tracked_objects = self._engine.process_frame(frame)

        events: list[DetectionEvent] = []
        for obj in tracked_objects:
            events.append(
                DetectionEvent(
                    event_type="OBJECT_TRACKED",
                    camera_id=camera_id,
                    frame_number=frame_number,
                    timestamp=round(timestamp, 4),
                    track_id=obj.track_id,
                    class_id=obj.class_id,
                    class_name=obj.class_name,
                    confidence=obj.confidence,
                    bbox=obj.bbox,
                )
            )
        return events
