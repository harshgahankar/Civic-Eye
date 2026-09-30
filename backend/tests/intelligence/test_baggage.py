"""BaggageTracker: owner association, departure, stationary duration."""
from __future__ import annotations

from app.intelligence.baggage import BaggageTracker


def _tracker() -> BaggageTracker:
    # Short thresholds keep the synthetic sequences fast; logic is identical.
    return BaggageTracker(stationary_seconds=2.0, owner_distance=50.0)


def _feed(tracker: BaggageTracker, t: float,
          bag_xy=(300.0, 300.0), person_xy=None) -> None:
    persons = [(5, *person_xy)] if person_xy else []
    tracker.update(t, [(8, "backpack", *bag_xy)], persons,
                   persons_present=bool(persons))


class TestBaggageTracker:
    def test_bag_with_owner_nearby_is_not_unattended(self) -> None:
        tr = _tracker()
        # Scenario E: owner stays next to the bag for the whole duration.
        for i in range(12):
            _feed(tr, i * 0.5, person_xy=(310.0, 310.0))
        assert tr.assess(5.5) == []

    def test_owner_leaves_then_bag_unattended(self) -> None:
        tr = _tracker()
        # Scenario B: owner nearby, then moves far away, then leaves ROI.
        for i in range(4):
            _feed(tr, i * 0.5, person_xy=(310.0, 310.0))
        for i in range(4, 8):
            _feed(tr, i * 0.5, person_xy=(600.0, 600.0))
        for i in range(8, 14):
            tr.update(i * 0.5, [(8, "backpack", 300.0, 300.0)], [],
                      persons_present=False)
        found = tr.assess(6.5)
        assert len(found) == 1
        assert found[0].unattended is True
        assert found[0].bag_track_id == 8
        assert 0.0 <= found[0].confidence <= 1.0
        types = {e.type for e in found[0].evidence}
        assert "OWNER_MOVED_AWAY" in types or "OWNER_LEFT_ROI" in types
        assert "STATIONARY_DURATION" in types

    def test_short_duration_not_unattended(self) -> None:
        tr = _tracker()
        for i in range(3):
            _feed(tr, i * 0.5, person_xy=(600.0, 600.0))
        assert tr.assess(1.0) == []  # below stationary threshold

    def test_stale_bags_pruned(self) -> None:
        tr = _tracker()
        _feed(tr, 0.0, person_xy=(310.0, 310.0))
        tr.prune(500.0)
        assert tr.assess(500.0) == []

    def test_class_flicker_merges_into_one_slot(self) -> None:
        # Same physical bag, YOLO alternates suitcase/handbag/backpack with
        # fresh track IDs at ~the same spot → single slot, kept duration.
        tr = BaggageTracker(stationary_seconds=2.0, owner_distance=50.0,
                            merge_distance=60.0)
        tr.update(0.0, [(8, "suitcase", 300.0, 300.0)], [(5, 600.0, 600.0)],
                  persons_present=True)
        tr.update(0.5, [(9, "handbag", 302.0, 301.0)], [(5, 600.0, 600.0)],
                  persons_present=True)
        tr.update(1.0, [(10, "backpack", 301.0, 299.0)], [(5, 600.0, 600.0)],
                  persons_present=True)
        assert len(tr._bags) == 1  # merged, not 3 phantom bags
        slot = next(iter(tr._bags.values()))
        assert slot.aliases == {9, 10}
        assert slot.seen_classes == {"suitcase", "handbag", "backpack"}
        assert slot.first_seen == 0.0  # duration continuity kept

    def test_distant_bags_stay_separate(self) -> None:
        tr = BaggageTracker(stationary_seconds=2.0, owner_distance=50.0,
                            merge_distance=60.0)
        tr.update(0.0, [(8, "suitcase", 100.0, 100.0)], [], True)
        tr.update(0.0, [(9, "suitcase", 500.0, 500.0)], [], True)
        assert len(tr._bags) == 2

    def test_duration_evidence_rate_limited(self) -> None:
        # Per-frame assess() must not flood evidence: first crossing + at
        # most one item per 5 s afterwards.
        tr = BaggageTracker(stationary_seconds=2.0, owner_distance=50.0,
                            merge_distance=60.0)
        for i in range(4):
            tr.update(i * 0.5, [(8, "backpack", 300.0, 300.0)],
                      [(5, 600.0, 600.0)], True)
        for i in range(4, 60):
            t = i * 0.5
            tr.update(t, [(8, "backpack", 300.0, 300.0)], [],
                      persons_present=False)
            found = tr.assess(t)
            for assessment in found:
                durations = [e for e in assessment.evidence
                             if e.type == "STATIONARY_DURATION"]
                assert len(durations) <= 7  # 28 s span / 5 s cap + slack
