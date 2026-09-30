"""False-alarm suppression rules carry explicit reason codes."""
from __future__ import annotations

from app.intelligence.false_alarm import should_suppress
from tests.intelligence.helpers import ev_item


class TestFalseAlarm:
    def test_rule1_single_frame_suppressed(self) -> None:
        d = should_suppress("ACCIDENT", [ev_item("POSSIBLE_COLLISION", 0.0)],
                            0.9, 0.0)
        assert d.suppressed is True
        assert d.reason == "single_frame_anomaly"

    def test_rule2_low_confidence_suppressed(self) -> None:
        ev = [ev_item("POSSIBLE_COLLISION", 0.0, 0.2, [1, 2]),
              ev_item("POSSIBLE_COLLISION", 0.5, 0.2, [1, 2])]
        d = should_suppress("ACCIDENT", ev, 0.2, 1.0)
        assert d.suppressed is True
        assert d.reason == "low_confidence_no_support"

    def test_rule5_proximity_without_corroboration(self) -> None:
        # Scenario D: proximity only, no span, nothing else.
        ev = [ev_item("POSSIBLE_COLLISION", 0.0, 0.9, [1, 2]),
              ev_item("POSSIBLE_COLLISION", 0.4, 0.9, [1, 2])]
        d = should_suppress("ACCIDENT", ev, 0.9, 0.4)
        assert d.suppressed is True
        assert d.reason == "proximity_without_corroboration"

    def test_rule5_passes_with_corroboration(self) -> None:
        ev = [ev_item("POSSIBLE_COLLISION", 0.0, 0.9, [1, 2]),
              ev_item("POSSIBLE_COLLISION", 0.4, 0.9, [1, 2]),
              ev_item("SUDDEN_STOP", 0.8, 0.85, [1])]
        d = should_suppress("ACCIDENT", ev, 0.88, 1.5)
        assert d.suppressed is False

    def test_rule4_transient_crowd_spike(self) -> None:
        ev = [ev_item("CROWD_MOVEMENT_ANOMALY", 0.0, 0.8, [1, 2, 3]),
              ev_item("CROWD_MOVEMENT_ANOMALY", 0.3, 0.8, [1, 2, 3])]
        d = should_suppress("CROWD_ANOMALY", ev, 0.8, 0.3)
        assert d.suppressed is True
        assert d.reason == "transient_crowd_spike"

    def test_strong_multi_signal_not_suppressed(self) -> None:
        ev = [ev_item("POSSIBLE_COLLISION", 0.0, 0.9, [1, 2]),
              ev_item("POSSIBLE_COLLISION", 0.5, 0.9, [1, 2]),
              ev_item("SUDDEN_STOP", 1.0, 0.85, [1]),
              ev_item("STATIONARY_OBJECT", 2.0, 0.8, [1])]
        d = should_suppress("ACCIDENT", ev, 0.86, 2.0)
        assert d.suppressed is False
        assert d.reason == ""
