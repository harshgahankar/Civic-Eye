"""Crowd anomaly confirmation: persistence required, neutral wording."""
from __future__ import annotations

from app.core.config import settings
from app.intelligence.crowd_anomaly import assess_crowd_anomaly
from tests.intelligence.helpers import ev_item


def _crowd_burst(n: int, conf: float = 0.7) -> list:
    return [ev_item("CROWD_MOVEMENT_ANOMALY", float(i) * 0.5, conf,
                    [1, 2, 3, 4, 5]) for i in range(n)]


class TestCrowdAnomaly:
    def test_single_signal_not_confirmed(self) -> None:
        a = assess_crowd_anomaly(_crowd_burst(1), span_seconds=0.0)
        assert a.confirmed is False

    def test_few_signals_not_confirmed(self) -> None:
        a = assess_crowd_anomaly(_crowd_burst(3), span_seconds=1.5)
        assert a.confirmed is False

    def test_persistent_anomaly_confirmed(self) -> None:
        # Scenario C: anomaly persists across the window.
        evidence = _crowd_burst(settings.CROWD_ANOMALY_MIN_EVIDENCE + 1, 0.7)
        a = assess_crowd_anomaly(
            evidence, span_seconds=3.0,
            latest_person_count=12, latest_density=0.35)
        assert a.confirmed is True
        assert 0.0 <= a.confidence <= 1.0
        assert any("abnormal crowd movement" in r for r in a.reasons)
        # Neutral wording: never panic/riot/terrorism claims.
        blob = " ".join(a.reasons).lower()
        assert "panic" not in blob
        assert "terror" not in blob
        assert "riot" not in blob
        assert "violent" not in blob

    def test_short_span_not_confirmed(self) -> None:
        # 6 signals crammed into 0.1 s (60 fps cold start) must not confirm.
        evidence = _crowd_burst(6, 0.9)
        a = assess_crowd_anomaly(evidence, span_seconds=0.1,
                                 latest_person_count=6, latest_density=0.3)
        assert a.confirmed is False

    def test_deterministic(self) -> None:
        evidence = _crowd_burst(6, 0.7)
        a1 = assess_crowd_anomaly(evidence, 3.0, 12, 0.35)
        a2 = assess_crowd_anomaly(evidence, 3.0, 12, 0.35)
        assert a1.confidence == a2.confidence
        assert a1.confirmed == a2.confirmed
