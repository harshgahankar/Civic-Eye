"""Golden regression for car3.mp4 (2 cars visibly collide, keep rolling).

Real pipeline shape (151 frames, 1280x720):
  7x POSSIBLE_COLLISION with speed_change_score=1.0, peak IoU ~0.13,
  2-3x TRAJECTORY_ANOMALY, 0x SUDDEN_STOP, 0x STATIONARY_OBJECT,
  span ~2.9s, track IDs churn across pairs sharing one car.

Locks in:
  - car3-shaped evidence MUST confirm (jolt + trajectory corroboration),
  - convoy-shaped evidence (overlap + traj, NO jolt) must still reject,
  - proximity-only must still reject,
  - fragmented pair signals sharing a track must merge into ONE candidate.
"""
from __future__ import annotations

from app.intelligence.accident import assess_accident
from app.intelligence.incident_engine import IncidentEngine
from app.schemas.incident import EvidenceItem
from tests.intelligence.helpers import bev, ev_item


def _jolt_collision(ts: float, tids: list[int], overlap: float,
                    conf: float = 0.55) -> EvidenceItem:
    return EvidenceItem(
        type="POSSIBLE_COLLISION", timestamp=ts, confidence=conf,
        track_ids=tids, source="behavior_engine",
        metadata={"overlap_score": overlap, "speed_change_score": 1.0,
                  "proximity_score": 0.5},
    )


def _car3_evidence() -> tuple[list[EvidenceItem], float]:
    ev = [
        _jolt_collision(0.30, [2, 5], 0.0, 0.53),
        _jolt_collision(0.57, [2, 10], 0.135, 0.48),
        ev_item("TRAJECTORY_ANOMALY", 1.03, 0.66, [2]),
        _jolt_collision(1.17, [2, 12], 0.0, 0.46),
        ev_item("TRAJECTORY_ANOMALY", 1.33, 0.40, [12]),
        _jolt_collision(1.33, [2, 17], 0.045, 0.60),
        _jolt_collision(1.33, [12, 17], 0.0, 0.51),
        _jolt_collision(2.23, [2, 12], 0.0, 0.57),
        _jolt_collision(3.23, [2, 12], 0.0, 0.56),
    ]
    return ev, 2.93


class TestCar3Golden:
    def test_car3_shape_confirms(self) -> None:
        ev, span = _car3_evidence()
        a = assess_accident(ev, span_seconds=span)
        assert a.confirmed is True, (
            f"car3-shaped crash must confirm, got {a.confidence} "
            f"{a.component_scores} {a.reasons}")
        assert any("sustained vehicle overlap" in r for r in a.reasons)

    def test_convoy_shape_still_rejects(self) -> None:
        # Same overlap + traj but NO jolt metadata (steady side-by-side flow).
        ev = [
            EvidenceItem(
                type="POSSIBLE_COLLISION", timestamp=float(i),
                confidence=0.7, track_ids=[17, 19],
                source="behavior_engine",
                metadata={"overlap_score": 0.15,
                          "proximity_score": 0.7},
            )
            for i in range(5)
        ]
        ev.append(ev_item("TRAJECTORY_ANOMALY", 2.5, 0.6, [19]))
        a = assess_accident(ev, span_seconds=4.0)
        assert a.confirmed is False

    def test_proximity_only_still_rejects(self) -> None:
        ev = [ev_item("POSSIBLE_COLLISION", float(i) * 0.4, 0.9, [17, 19])
              for i in range(3)]
        a = assess_accident(ev, span_seconds=0.8)
        assert a.confirmed is False


class TestFragmentedMerge:
    def test_shared_track_pairs_merge_and_confirm(self) -> None:
        engine = IncidentEngine("CAM_01")
        seq = [
            bev("POSSIBLE_COLLISION", 0.3, [2, 5], ["car", "car"], 0.53,
                metadata={"overlap_score": 0.0,
                          "speed_change_score": 1.0}),
            bev("POSSIBLE_COLLISION", 0.6, [2, 10], ["car", "car"], 0.48,
                metadata={"overlap_score": 0.135,
                          "speed_change_score": 1.0}),
            bev("TRAJECTORY_ANOMALY", 1.0, [2], ["car"], 0.66),
            bev("POSSIBLE_COLLISION", 1.2, [2, 12], ["car", "car"], 0.46,
                metadata={"overlap_score": 0.0,
                          "speed_change_score": 1.0}),
            bev("TRAJECTORY_ANOMALY", 1.3, [12], ["car"], 0.40),
            bev("POSSIBLE_COLLISION", 2.2, [2, 12], ["car", "car"], 0.57,
                metadata={"overlap_score": 0.0,
                          "speed_change_score": 1.0}),
            bev("POSSIBLE_COLLISION", 3.2, [2, 12], ["car", "car"], 0.56,
                metadata={"overlap_score": 0.0,
                          "speed_change_score": 1.0}),
        ]
        confirmed = []
        for e in seq:
            for inc in engine.process_behavior_event(e):
                if inc.status == "CONFIRMED":
                    confirmed.append(inc)
        accidents = [i for i in engine.get_active_incidents()
                     if i.incident_type == "ACCIDENT"]
        # One merged candidate, not 4 fragmented ones.
        assert len(accidents) == 1, (
            f"expected 1 merged accident, got {len(accidents)}")
        assert confirmed, "fragmented car3 sequence must CONFIRM after merge"
        assert set([2, 12]).issubset(set(confirmed[-1].track_ids))
