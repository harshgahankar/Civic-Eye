"""Perception filters: class whitelist + minimum track age (no YOLO needed)."""
from __future__ import annotations

import numpy as np

from app.ai.tracker import TrackedObject
from app.pipeline.frame_processor import (
    FrameProcessor,
    effective_model_confidence,
    parse_allowed_classes,
    parse_class_confidence,
)
from app.schemas.detection import BBoxModel


class FakeEngine:
    """Stand-in for InferenceEngine returning scripted tracks per call."""

    def __init__(self, script: list[list[TrackedObject]]) -> None:
        self._script = script
        self._calls = 0

    def process_frame(self, frame) -> list[TrackedObject]:
        out = self._script[min(self._calls, len(self._script) - 1)]
        self._calls += 1
        return out

    def reset(self) -> None:
        self._calls = 0


def _obj(track_id: int, class_name: str = "car",
           confidence: float = 0.9) -> TrackedObject:
    return TrackedObject(track_id, 2, class_name, confidence,
                         BBoxModel(x1=0.0, y1=0.0, x2=10.0, y2=10.0))


def _frame() -> np.ndarray:
    return np.zeros((480, 640, 3), dtype=np.uint8)


class TestParseAllowed:
    def test_empty_means_allow_all(self) -> None:
        assert parse_allowed_classes("") is None
        assert parse_allowed_classes("  ") is None

    def test_parses_case_insensitive(self) -> None:
        assert parse_allowed_classes("Person, CAR") == {"person", "car"}


class TestWhitelist:
    def test_blocked_class_dropped(self) -> None:
        proc = FrameProcessor(FakeEngine([[_obj(1, "refrigerator")]]),
                              allowed_classes={"person", "car"},
                              min_track_age=1)
        assert proc.process_frame(_frame(), "CAM_01", 0, 0.0) == []

    def test_allowed_class_passes(self) -> None:
        proc = FrameProcessor(FakeEngine([[_obj(1, "Person")]]),
                              allowed_classes={"person"},
                              min_track_age=1)
        events = proc.process_frame(_frame(), "CAM_01", 0, 0.0)
        assert len(events) == 1
        assert events[0].class_name == "Person"

    def test_no_whitelist_allows_everything(self) -> None:
        proc = FrameProcessor(
            FakeEngine([[_obj(1, "refrigerator"), _obj(2, "cat")]]),
            allowed_classes=set(), min_track_age=1)
        assert len(proc.process_frame(_frame(), "CAM_01", 0, 0.0)) == 2


class TestMinTrackAge:
    def test_young_track_held_back(self) -> None:
        proc = FrameProcessor(FakeEngine([[ _obj(1) ]] * 5),
                              allowed_classes=set(), min_track_age=3)
        assert proc.process_frame(_frame(), "CAM_01", 0, 0.0) == []
        assert proc.process_frame(_frame(), "CAM_01", 1, 0.1) == []
        events = proc.process_frame(_frame(), "CAM_01", 2, 0.2)
        assert len(events) == 1  # 3rd consecutive frame → emitted
        assert proc.process_frame(_frame(), "CAM_01", 3, 0.3) != []

    def test_age_one_disables_gating(self) -> None:
        proc = FrameProcessor(FakeEngine([[_obj(1)]]),
                              allowed_classes=set(), min_track_age=1)
        assert len(proc.process_frame(_frame(), "CAM_01", 0, 0.0)) == 1

    def test_cameras_tracked_independently(self) -> None:
        proc = FrameProcessor(FakeEngine([[_obj(1)]] * 4),
                              allowed_classes=set(), min_track_age=2)
        assert proc.process_frame(_frame(), "CAM_01", 0, 0.0) == []
        # Same track_id on another camera starts at age 1.
        assert proc.process_frame(_frame(), "CAM_02", 0, 0.0) == []
        assert len(proc.process_frame(_frame(), "CAM_01", 1, 0.1)) == 1

    def test_reset_clears_age(self) -> None:
        proc = FrameProcessor(FakeEngine([[_obj(1)]] * 4),
                              allowed_classes=set(), min_track_age=2)
        proc.process_frame(_frame(), "CAM_01", 0, 0.0)
        proc.reset()
        assert proc.process_frame(_frame(), "CAM_01", 1, 0.1) == []


class TestParseClassConfidence:
    def test_empty(self) -> None:
        assert parse_class_confidence("") == {}
        assert parse_class_confidence(None) == {}

    def test_parses(self) -> None:
        assert parse_class_confidence("suitcase:0.25, Handbag:0.3") == {
            "suitcase": 0.25, "handbag": 0.3}

    def test_rejects_garbage(self) -> None:
        assert parse_class_confidence("suitcase:abc,no-colon,car:5.0") == {}

    def test_effective_is_minimum(self) -> None:
        assert effective_model_confidence(0.5, {}) == 0.5
        assert effective_model_confidence(
            0.5, {"suitcase": 0.25}) == 0.25


class TestPerClassBar:
    def test_low_bar_class_passes(self) -> None:
        proc = FrameProcessor(
            FakeEngine([[_obj(1, "suitcase", 0.31)]]),
            allowed_classes=set(), min_track_age=1,
            class_confidence={"suitcase": 0.25})
        assert len(proc.process_frame(_frame(), "CAM_01", 0, 0.0)) == 1

    def test_below_own_bar_dropped(self) -> None:
        proc = FrameProcessor(
            FakeEngine([[_obj(1, "suitcase", 0.2)]]),
            allowed_classes=set(), min_track_age=1,
            class_confidence={"suitcase": 0.25})
        assert proc.process_frame(_frame(), "CAM_01", 0, 0.0) == []

    def test_alias_normalizes_bag_labels(self) -> None:
        from app.pipeline.frame_processor import parse_class_aliases
        assert parse_class_aliases("backpack:bag,suitcase:bag") == {
            "backpack": "bag", "suitcase": "bag"}
        assert parse_class_aliases("") == {}
        proc = FrameProcessor(
            FakeEngine([[_obj(1, "Suitcase")]]),
            allowed_classes=set(), min_track_age=1)
        events = proc.process_frame(_frame(), "CAM_01", 0, 0.0)
        # Default AI_CLASS_ALIASES maps suitcase → bag.
        assert events[0].class_name == "bag"
        assert events[0].class_id == 2  # original id preserved

    def test_unlisted_class_uses_global(self) -> None:
        from app.core.config import settings
        proc = FrameProcessor(
            FakeEngine([[_obj(1, "car", 0.9)]]),
            allowed_classes=set(), min_track_age=1,
            class_confidence={"suitcase": 0.25})
        # car at 0.9 ≥ global threshold → passes regardless of overrides
        assert settings.AI_CONFIDENCE_THRESHOLD <= 0.9
        assert len(proc.process_frame(_frame(), "CAM_01", 0, 0.0)) == 1
