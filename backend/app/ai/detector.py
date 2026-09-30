"""
app/ai/detector.py

YOLO object detector wrapper.

Loads the model once on construction and reuses it for all subsequent
detect() calls.  Returns a list of RawDetection objects.

Device resolution:
    "auto"   → CUDA if available, otherwise CPU
    "cpu"    → CPU
    "cuda"   → CUDA (fails fast if unavailable)
    "cuda:N" → specific GPU
"""

from __future__ import annotations

import numpy as np
import torch
from ultralytics import YOLO

from app.core.logging import get_logger
from app.schemas.detection import BBoxModel, RawDetection

logger = get_logger(__name__)

# COCO class IDs we care about (others are silently filtered out at caller side)
DEFAULT_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
    24: "backpack",
    26: "handbag",
    28: "suitcase",
}


def _resolve_device(device_setting: str) -> str:
    """Translate config value to a concrete torch device string."""
    if device_setting == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return device_setting


class ObjectDetector:
    """
    Thin wrapper around a YOLO model.

    Usage:
        detector = ObjectDetector("yolo11n.pt", confidence=0.35, iou=0.45, device="auto")
        raw_detections = detector.detect(frame_bgr)
    """

    def __init__(
        self,
        model_name: str = "yolo11n.pt",
        confidence: float = 0.35,
        iou: float = 0.45,
        device: str = "auto",
        image_size: int = 640,
    ) -> None:
        self._model_name = model_name
        self._confidence = confidence
        self._iou = iou
        self._image_size = image_size
        self._device = _resolve_device(device)

        logger.info("Loading YOLO model '%s' on device '%s'", model_name, self._device)
        self._model = YOLO(model_name)
        # Warm up: run a dummy inference so the first real frame isn't slow
        self._warmup()
        logger.info("AI device: %s", self._device.upper())

    def _warmup(self) -> None:
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        self._model.predict(
            dummy,
            device=self._device,
            imgsz=self._image_size,
            conf=self._confidence,
            iou=self._iou,
            verbose=False,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def class_names(self) -> dict[int, str]:
        """Return the model's class-name mapping."""
        return self._model.names  # type: ignore[return-value]

    def detect(self, frame: np.ndarray) -> list[RawDetection]:
        """
        Run inference on a single BGR frame (NumPy array from OpenCV).

        Returns a list of RawDetection objects — one per detected object.
        Empty list if nothing is detected above the confidence threshold.
        """
        results = self._model.predict(
            frame,
            device=self._device,
            imgsz=self._image_size,
            conf=self._confidence,
            iou=self._iou,
            verbose=False,
        )

        detections: list[RawDetection] = []
        for result in results:
            if result.boxes is None or len(result.boxes) == 0:
                continue
            boxes = result.boxes
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                conf = float(boxes.conf[i].item())
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()

                # Clamp and validate coords
                x1, y1, x2, y2 = float(x1), float(y1), float(x2), float(y2)
                if x2 <= x1 or y2 <= y1:
                    continue  # degenerate box — skip

                # Resolve class name from model's own names dict
                model_names: dict = self._model.names  # type: ignore
                cls_name = model_names.get(cls_id, f"class_{cls_id}")

                detections.append(
                    RawDetection(
                        class_id=cls_id,
                        class_name=cls_name,
                        confidence=max(0.0, min(1.0, conf)),
                        bbox=BBoxModel(x1=x1, y1=y1, x2=x2, y2=y2),
                    )
                )
        return detections
