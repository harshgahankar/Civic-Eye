"""TemporalVerifier: evidence window, count, confidence, cooldown."""
from __future__ import annotations

from app.intelligence.temporal_verifier import TemporalVerifier
from tests.intelligence.helpers import ev_item


def _verifier(**kw) -> TemporalVerifier:
    return TemporalVerifier(
        window_seconds=5.0, min_evidence=3, min_mean_confidence=0.4,
        cooldown_seconds=30.0, **kw)


class TestTemporalVerifier:
    def test_single_item_not_verified(self) -> None:
        v = _verifier()
        res = v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", 0.0, 0.95))
        assert res.verified is False
        assert res.reason == "insufficient_temporal_evidence"

    def test_three_items_within_window_verified(self) -> None:
        v = _verifier()
        for t in (0.0, 0.5, 1.0):
            res = v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", t, 0.9))
        assert res.verified is True
        assert res.evidence_count == 3
        assert res.mean_confidence == 0.9

    def test_old_evidence_ages_out_of_window(self) -> None:
        v = _verifier()
        v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", 0.0, 0.9))
        v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", 0.5, 0.9))
        # Jump past the 5s window: only this item remains → not verified.
        res = v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", 10.0, 0.9))
        assert res.verified is False
        assert res.evidence_count == 1

    def test_low_confidence_not_verified(self) -> None:
        v = _verifier()
        for t in (0.0, 0.5, 1.0):
            res = v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", t, 0.1))
        assert res.verified is False
        assert res.reason == "low_evidence_confidence"

    def test_cooldown_suppresses_reverify_after_emission(self) -> None:
        v = _verifier()
        for t in (0.0, 0.5, 1.0):
            res = v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", t, 0.9))
        assert res.verified is True
        # No emission yet → no cooldown: keeps verifying.
        res2 = v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", 1.5, 0.9))
        assert res2.verified is True
        # After the owner acts on it (emission), cooldown suppresses.
        v.mark_verified(("CAM_01", "k1"), 1.5)
        res3 = v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", 2.0, 0.9))
        assert res3.verified is False
        assert res3.reason == "cooldown_duplicate_suppressed"
        # After the cooldown window, fresh evidence verifies again.
        for t in (40.0, 40.5, 41.0):
            res4 = v.add(("CAM_01", "k1"),
                         ev_item("POSSIBLE_COLLISION", t, 0.9))
        assert res4.verified is True

    def test_keys_are_independent(self) -> None:
        v = _verifier()
        for t in (0.0, 0.5, 1.0):
            v.add(("CAM_01", "k1"), ev_item("POSSIBLE_COLLISION", t, 0.9))
        res = v.add(("CAM_01", "k2"), ev_item("POSSIBLE_COLLISION", 1.0, 0.9))
        assert res.verified is False  # k2 has only one item
