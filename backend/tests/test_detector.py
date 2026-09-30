"""
tests/test_detector.py

Tests for the ObjectDetector (YOLO wrapper).

Unit tests use synthetic frames (no real video required).
The integration test actually loads the YOLO model — this is intentional.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.schemas.detection import BBoxModel, RawDetection


# ── Synthetic frame helpers ────────────────────────────────────────────────────

def _black_frame(h: int = 480, w: int = 640) -> np.ndarray:
    return np.zeros((h, w, 3), dtype=np.uint8)


def _noisy_frame(h: int = 480, w: int = 640) -> np.ndarray:
    rng = np.random.default_rng(42)
    return (rng.random((h, w, 3)) * 255).astype(np.uint8)


# ── BBoxModel unit tests ──────────────────────────────────────────────────────

class TestBBoxModel:
    def test_valid_bbox(self) -> None:
        b = BBoxModel(x1=10, y1=20, x2=100, y2=200)
        assert b.width == 90
        assert b.height == 180
        assert b.area == 90 * 180

    def test_invalid_x2_leq_x1(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            BBoxModel(x1=100, y1=20, x2=50, y2=200)

    def test_invalid_y2_leq_y1(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            BBoxModel(x1=10, y1=200, x2=100, y2=50)

    def test_from_xyxy(self) -> None:
        b = BBoxModel.from_xyxy(5.0, 10.0, 50.0, 80.0)
        assert b.x1 == 5.0
        assert b.y2 == 80.0


# ── RawDetection unit tests ───────────────────────────────────────────────────

class TestRawDetection:
    def test_valid_detection(self) -> None:
        d = RawDetection(
            class_id=2,
            class_name="car",
            confidence=0.87,
            bbox=BBoxModel(x1=10, y1=10, x2=200, y2=150),
        )
        assert d.class_name == "car"
        assert d.confidence == 0.87

    def test_confidence_out_of_range(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            RawDetection(
                class_id=2,
                class_name="car",
                confidence=1.5,
                bbox=BBoxModel(x1=10, y1=10, x2=200, y2=150),
            )


# ── Detector integration test ─────────────────────────────────────────────────

class TestObjectDetector:
    """
    These tests actually load the YOLO model.
    They are skipped if the model download fails.
    """

    @pytest.fixture(scope="class")
    def detector(self):
        try:
            from app.ai.detector import ObjectDetector
            return ObjectDetector(
                model_name="yolo11n.pt",
                confidence=0.35,
                iou=0.45,
                device="auto",
            )
        except Exception as exc:
            pytest.skip(f"YOLO model unavailable: {exc}")

    def test_detector_initializes(self, detector) -> None:
        from app.ai.detector import ObjectDetector
        assert isinstance(detector, ObjectDetector)

    def test_detector_has_class_names(self, detector) -> None:
        names = detector.class_names
        assert isinstance(names, dict)
        assert len(names) > 0
        # COCO has 80 classes; yolo11n is trained on COCO
        assert 0 in names  # person
        assert 2 in names  # car

    def test_detect_returns_list(self, detector) -> None:
        frame = _black_frame()
        results = detector.detect(frame)
        assert isinstance(results, list)
        # Black frame should produce no detections
        assert len(results) == 0

    def test_detect_noisy_frame(self, detector) -> None:
        frame = _noisy_frame()
        results = detector.detect(frame)
        # Noisy frames may or may not produce detections — just verify type
        assert isinstance(results, list)
        for r in results:
            assert isinstance(r, RawDetection)
            assert 0.0 <= r.confidence <= 1.0
            assert r.bbox.x2 > r.bbox.x1
            assert r.bbox.y2 > r.bbox.y1

    def test_detect_with_drawn_rectangle(self, detector) -> None:
        """A frame with a clearly drawn person-shaped rectangle."""
        import cv2
        frame = _black_frame()
        # Draw a tall white rectangle (person-like shape)
        cv2.rectangle(frame, (200, 100), (260, 350), (255, 255, 255), -1)
        results = detector.detect(frame)
        # YOLO may or may not detect a synthetic rectangle — just verify contract
        assert isinstance(results, list)
