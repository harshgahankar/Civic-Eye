"""
tests/test_camera_stream.py

Live camera stream manager — hardware-free tests (stub inference engine;
a sample video file doubles as a finite "camera" source).
"""
from __future__ import annotations

import time

import pytest

from app.pipeline.camera_stream import (
    CameraStreamError,
    CameraStreamManager,
    _resolve_source,
)

SAMPLE = "../data/videos/sample/car2.mp4"


class _StubEngine:
    """No detections — exercises loop, counters, snapshot, shutdown."""

    def process_frame(self, frame):  # noqa: ANN001, ANN202
        return []


def _wait_until(predicate, timeout: float = 20.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(0.2)
    return predicate()


class TestResolveSource:
    def test_int_passthrough(self) -> None:
        assert _resolve_source(0) == 0
        assert _resolve_source(1) == 1

    def test_numeric_string_becomes_index(self) -> None:
        assert _resolve_source("0") == 0

    def test_url_and_path_stay_strings(self) -> None:
        assert _resolve_source("rtsp://x/y") == "rtsp://x/y"
        assert _resolve_source("a.mp4") == "a.mp4"

    def test_bad_sources_rejected(self) -> None:
        with pytest.raises(CameraStreamError):
            _resolve_source(-1)
        with pytest.raises(CameraStreamError):
            _resolve_source("   ")


class TestCameraStream:
    def test_bad_source_fails_fast(self) -> None:
        mgr = CameraStreamManager(engine_factory=_StubEngine)
        with pytest.raises(CameraStreamError):
            mgr.start(camera_id="CAM-T", source="/nonexistent/file.mp4")

    def test_duplicate_start_rejected(self) -> None:
        mgr = CameraStreamManager(engine_factory=_StubEngine)
        mgr.start(camera_id="CAM-T", source=SAMPLE, fps=30.0)
        try:
            with pytest.raises(CameraStreamError):
                mgr.start(camera_id="CAM-T2", source=SAMPLE, fps=30.0)
        finally:
            mgr.stop()

    def test_file_source_runs_and_stops(self) -> None:
        mgr = CameraStreamManager(engine_factory=_StubEngine)
        status = mgr.start(camera_id="CAM-T", source=SAMPLE, fps=30.0)
        assert status["running"] is True
        assert status["camera_id"] == "CAM-T"
        assert status["width"] > 0

        assert _wait_until(
            lambda: mgr.get_status()["frames_processed"] > 5, timeout=30.0)

        snap = mgr.get_snapshot()
        assert snap is not None
        assert snap[:2] == b"\xff\xd8"  # JPEG magic

        final = mgr.stop()
        assert final["running"] is False
        assert final["frames_processed"] > 5
        assert "confirmed_ids" in final

    def test_stop_when_idle_is_safe(self) -> None:
        mgr = CameraStreamManager(engine_factory=_StubEngine)
        status = mgr.stop()
        assert status["running"] is False
