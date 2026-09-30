"""
app/ai/tracker.py

ByteTrack-based object tracker using the Ultralytics built-in tracking API.

Key design decision:
    We use YOLO.track() rather than running detect() then a separate tracker.
    This is the recommended approach for Ultralytics 8.x:
      - YOLO.track(source, persist=True, tracker="bytetrack.yaml")
    The `persist=True` flag makes ByteTrack maintain state across calls
    on the SAME model instance.

Each TrackedObject retains a stable track_id across frames for the same
physical object, which is exactly what downstream analysis modules need.
"""

from __future__ import annotations

import os

import numpy as np
import torch
import ultralytics
from ultralytics import YOLO

from app.core.logging import get_logger
from app.schemas.detection import BBoxModel

logger = get_logger(__name__)


def _resolve_device(device_setting: str) -> str:
    if device_setting == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return device_setting


def _bytetrack_config_path() -> str:
    """Return the absolute path to the bundled bytetrack.yaml."""
    ul_dir = os.path.dirname(ultralytics.__file__)
    return os.path.join(ul_dir, "cfg", "trackers", "bytetrack.yaml")


class TrackedObject:
    """
    A single tracked detection for one frame.

    Attributes
    ----------
    track_id  : stable ID assigned by ByteTrack across frames
    class_id  : YOLO class index
    class_name: human-readable class label
    confidence: detection confidence [0, 1]
    bbox      : BBoxModel(x1, y1, x2, y2)
    """

    __slots__ = ("track_id", "class_id", "class_name", "confidence", "bbox")

    def __init__(
        self,
        track_id: int,
        class_id: int,
        class_name: str,
        confidence: float,
        bbox: BBoxModel,
    ) -> None:
        self.track_id = track_id
        self.class_id = class_id
        self.class_name = class_name
        self.confidence = confidence
        self.bbox = bbox

    def __repr__(self) -> str:
        return (
            f"TrackedObject(id={self.track_id}, cls={self.class_name}, "
            f"conf={self.confidence:.2f}, bbox={self.bbox})"
        )


class ByteTracker:
    """
    Wraps YOLO.track() with persist=True so ByteTrack maintains
    cross-frame state on a single model instance.

    Usage:
        tracker = ByteTracker("yolo11n.pt", confidence=0.35, device="auto")

        for frame in video:
            tracked = tracker.track(frame)
            for obj in tracked:
                print(obj.track_id, obj.class_name)
    """

    def __init__(
        self,
        model_name: str = "yolo11n.pt",
        confidence: float = 0.35,
        iou: float = 0.45,
        device: str = "auto",
        image_size: int = 640,
        tracker_config: str = "bytetrack.yaml",
    ) -> None:
        self._model_name = model_name
        self._confidence = confidence
        self._iou = iou
        self._image_size = image_size
        self._device = _resolve_device(device)

        # Resolve tracker config path
        if os.path.isabs(tracker_config) and os.path.exists(tracker_config):
            self._tracker_config = tracker_config
        else:
            # Use bundled config
            self._tracker_config = _bytetrack_config_path()

        logger.info(
            "Loading ByteTracker model '%s' on '%s' with config '%s'",
            model_name,
            self._device,
            self._tracker_config,
        )
        self._model = YOLO(model_name)
        logger.info("ByteTracker ready — AI device: %s", self._device.upper())

    def reset(self) -> None:
        """Re-initialize a fresh model instance to reset all track state."""
        self._model = YOLO(self._model_name)
        logger.debug("ByteTracker state reset.")

    def track(self, frame: np.ndarray) -> list[TrackedObject]:
        """
        Run detect+track on a single BGR frame.

        Returns a list of TrackedObject instances.
        Track IDs are stable across consecutive calls on the same instance.
        """
        results = self._model.track(
            frame,
            persist=True,           # critical: keep ByteTrack state
            tracker=self._tracker_config,
            device=self._device,
            imgsz=self._image_size,
            conf=self._confidence,
            iou=self._iou,
            verbose=False,
        )

        tracked: list[TrackedObject] = []
        for result in results:
            if result.boxes is None or len(result.boxes) == 0:
                continue
            boxes = result.boxes

            # boxes.id is None when the tracker hasn't assigned IDs yet
            # (can happen on the very first frame or low-confidence frames)
            ids = boxes.id
            if ids is None:
                continue

            model_names: dict = self._model.names  # type: ignore
            for i in range(len(boxes)):
                track_id_val = ids[i]
                if track_id_val is None:
                    continue
                track_id = int(track_id_val.item())
                cls_id = int(boxes.cls[i].item())
                conf = float(boxes.conf[i].item())
                x1, y1, x2, y2 = [float(v) for v in boxes.xyxy[i].tolist()]

                if x2 <= x1 or y2 <= y1:
                    continue  # degenerate box

                cls_name = model_names.get(cls_id, f"class_{cls_id}")

                tracked.append(
                    TrackedObject(
                        track_id=track_id,
                        class_id=cls_id,
                        class_name=cls_name,
                        confidence=max(0.0, min(1.0, conf)),
                        bbox=BBoxModel(x1=x1, y1=y1, x2=x2, y2=y2),
                    )
                )
        return tracked
