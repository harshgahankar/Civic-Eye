"""Accident assessment: multi-signal scoring, proximity-alone rejection."""
from __future__ import annotations

from app.core.config import settings
from app.intelligence.accident import assess_accident
from app.schemas.incident import EvidenceItem
from tests.intelligence.helpers import ev_item


def _collision_burst(n: int = 3, conf: float = 0.9) -> list:
    return [ev_item("POSSIBLE_COLLISION", float(i) * 0.4, conf, [17, 19])
            for i in range(n)]


class TestAccidentAssessment:
    def test_proximity_alone_does_not_confirm(self) -> None:
        evidence = _collision_burst(3, 0.9)
        a = assess_accident(evidence, span_seconds=0.8)
        assert a.confirmed is False

    def test_single_frame_does_not_confirm(self) -> None:
        evidence = [ev_item("POSSIBLE_COLLISION", 0.0, 0.95, [17, 19])]
        a = assess_accident(evidence, span_seconds=0.0)
        assert a.confirmed is False

    def test_multi_signal_confirms(self) -> None:
        evidence = [
            *_collision_burst(3, 0.9),
            ev_item("SUDDEN_STOP", 1.4, 0.85, [17]),
            ev_item("SUDDEN_STOP", 1.8, 0.85, [19]),
            ev_item("STATIONARY_OBJECT", 2.4, 0.8, [17]),
            ev_item("STATIONARY_OBJECT", 2.8, 0.8, [19]),
        ]
        a = assess_accident(evidence, span_seconds=2.8)
        assert a.confirmed is True
        assert 0.0 <= a.confidence <= 1.0
        assert a.component_scores["collision_score"] > 0
        assert a.component_scores["deceleration_score"] > 0
        assert a.component_scores["stationary_score"] > 0
        assert len(a.reasons) >= 3

    def test_scores_bounded_and_deterministic(self) -> None:
        evidence = _collision_burst(3, 0.9)
        a1 = assess_accident(evidence, span_seconds=0.8)
        a2 = assess_accident(evidence, span_seconds=0.8)
        assert a1.confidence == a2.confidence
        assert a1.component_scores == a2.component_scores
        for score in a1.component_scores.values():
            assert 0.0 <= score <= 1.0

    def test_short_span_not_confirmed(self) -> None:
        evidence = _collision_burst(3, 0.95)
        a = assess_accident(evidence, span_seconds=0.05)
        assert a.confirmed is False

    def test_empty_evidence_scores_zero(self) -> None:
        a = assess_accident([], span_seconds=0.0)
        assert a.confidence == 0.0
        assert a.confirmed is False

    def test_threshold_comes_from_config(self) -> None:
        assert settings.ACCIDENT_CONFIRMATION_THRESHOLD == 0.55
        assert settings.ACCIDENT_MIN_EVIDENCE == 3

    @staticmethod
    def _overlap_collision(timestamp: float, conf: float = 0.7) -> EvidenceItem:
        return EvidenceItem(
            type="POSSIBLE_COLLISION", timestamp=timestamp, confidence=conf,
            track_ids=[17, 19], source="behavior_engine",
            metadata={"overlap_score": 0.15, "proximity_score": 0.7},
        )

    def test_sustained_overlap_with_stop_confirms(self) -> None:
        # Real crash: repeated overlap + a speed collapse. Without the
        # sustained-impact bonus this caps below threshold.
        evidence = [
            self._overlap_collision(0.0), self._overlap_collision(1.0),
            self._overlap_collision(2.0), self._overlap_collision(3.0),
            ev_item("SUDDEN_STOP", 2.2, 0.85, [17]),
        ]
        a = assess_accident(evidence, span_seconds=3.0)
        assert a.confirmed is True
        assert any("sustained vehicle overlap" in r for r in a.reasons)

    def test_sustained_overlap_traj_only_rejected(self) -> None:
        # Side-by-side convoy (bus alongside cars): sustained small
        # overlaps + jitter trajectory blips, nobody slowing down.
        # Trajectory-only corroboration must not earn the bonus.
        evidence = [
            self._overlap_collision(0.0), self._overlap_collision(1.0),
            self._overlap_collision(2.0), self._overlap_collision(3.0),
            self._overlap_collision(4.0),
            ev_item("TRAJECTORY_ANOMALY", 2.5, 0.6, [19]),
        ]
        a = assess_accident(evidence, span_seconds=4.0)
        assert a.confirmed is False
        assert not any("sustained vehicle overlap" in r for r in a.reasons)
