"""Camera health: ONLINE/DEGRADED/OFFLINE transitions + change events."""
from __future__ import annotations

from app.services.camera_health import CameraHealthService


class TestCameraHealth:
    def test_online_when_fps_ok(self) -> None:
        svc = CameraHealthService(offline_timeout=10.0, degraded_fps=5.0)
        h = svc.report_frame("CAM-01", fps=24.0, timestamp=100.0)
        assert h.status == "ONLINE"
        assert h.frames_processed == 1

    def test_degraded_when_fps_low(self) -> None:
        svc = CameraHealthService(offline_timeout=10.0, degraded_fps=5.0)
        h = svc.report_frame("CAM-01", fps=2.0, timestamp=100.0)
        assert h.status == "DEGRADED"

    def test_offline_after_timeout(self) -> None:
        svc = CameraHealthService(offline_timeout=10.0, degraded_fps=5.0)
        svc.report_frame("CAM-01", fps=24.0, timestamp=100.0)
        h = svc.evaluate("CAM-01", now=115.0)
        assert h.status == "OFFLINE"

    def test_no_premature_offline(self) -> None:
        svc = CameraHealthService(offline_timeout=10.0, degraded_fps=5.0)
        svc.report_frame("CAM-01", fps=24.0, timestamp=100.0)
        assert svc.evaluate("CAM-01", now=105.0).status == "ONLINE"

    def test_change_listener_fires_once_per_transition(self) -> None:
        changes: list = []
        svc = CameraHealthService(offline_timeout=10.0, degraded_fps=5.0,
                                  on_change=lambda c, s,
                                  p: changes.append((c, s)))
        svc.report_frame("CAM-01", fps=24.0, timestamp=100.0)
        assert changes == [("CAM-01", "ONLINE")]
        svc.report_frame("CAM-01", fps=24.0, timestamp=101.0)
        assert len(changes) == 1  # no duplicate event without transition
        svc.evaluate("CAM-01", now=200.0)
        assert changes[-1] == ("CAM-01", "OFFLINE")

    def test_error_increments(self) -> None:
        svc = CameraHealthService()
        h = svc.report_error("CAM-01")
        assert h.errors == 1
