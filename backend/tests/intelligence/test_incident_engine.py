"""IncidentEngine end-to-end on deterministic synthetic sequences.

Scenario A: converging vehicles → multi-signal → CONFIRMED ACCIDENT.
Scenario B: person leaves bag → UNATTENDED_BAGGAGE.
Scenario C: persistent crowd anomaly → CROWD_ANOMALY.
Scenario D: proximity only → no accident.
Scenario E: bag + owner nearby → no baggage (via engine detections path).
Scenario F: short crowd spike → suppressed, no incident.
Plus: single signal ≠ confirmed, dedup merge, bounds, resolve/dispatch.
"""
from __future__ import annotations

import pytest

from app.intelligence.incident_engine import IncidentEngine
from app.schemas.incident import IncidentDetail
from tests.intelligence.helpers import bev, det


def _collision_bev(ts: float, conf: float = 0.9) -> object:
    return bev("POSSIBLE_COLLISION", ts, [17, 19], ["car", "car"], conf)


class TestSingleSignalNotConfirmed:
    def test_one_collision_stays_unconfirmed(self) -> None:
        engine = IncidentEngine("CAM_01")
        changed = engine.process_behavior_event(_collision_bev(0.0))
        active = engine.get_active_incidents()
        assert not any(i.status == "CONFIRMED" for i in active)
        # A candidate exists but is still DETECTED/VERIFYING.
        assert len(active) == 1
        assert active[0].status in ("DETECTED", "VERIFYING")


class TestScenarioA:
    """Vehicle 17 + 19 converge, decelerate, stop → CONFIRMED ACCIDENT."""

    def test_accident_confirmed(self) -> None:
        engine = IncidentEngine("CAM_01")
        events = [
            _collision_bev(0.0, 0.9),
            _collision_bev(0.4, 0.9),
            _collision_bev(0.8, 0.9),
            bev("SUDDEN_STOP", 1.2, [17], ["car"], 0.85),
            bev("SUDDEN_STOP", 1.6, [19], ["car"], 0.85),
            bev("TRAJECTORY_ANOMALY", 2.0, [19], ["car"], 0.7),
            bev("STATIONARY_OBJECT", 2.6, [17], ["car"], 0.8),
            bev("STATIONARY_OBJECT", 3.0, [19], ["car"], 0.8),
        ]
        confirmed = []
        for e in events:
            for inc in engine.process_behavior_event(e):
                if inc.status == "CONFIRMED":
                    confirmed.append(inc)
        assert confirmed, "expected a CONFIRMED accident"
        inc = confirmed[-1]
        assert inc.incident_type == "ACCIDENT"
        assert inc.camera_id == "CAM_01"
        assert set([17, 19]).issubset(set(inc.track_ids))
        assert 0.0 <= inc.confidence <= 1.0
        assert inc.severity in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
        assert len(inc.evidence) >= 3
        assert len(inc.reasons) >= 2
        assert inc.recommended_action  # response recommendation present
        assert inc.incident_id.startswith("INC-")

    def test_incident_ids_unique(self) -> None:
        a = IncidentDetail(camera_id="C", incident_type="ACCIDENT",
                           confidence=0.5, first_detected_at=0.0,
                           last_updated_at=0.0)
        b = IncidentDetail(camera_id="C", incident_type="ACCIDENT",
                           confidence=0.5, first_detected_at=0.0,
                           last_updated_at=0.0)
        assert a.incident_id != b.incident_id


class TestScenarioD:
    """Proximity only → never a confirmed accident."""

    def test_proximity_only_no_accident(self) -> None:
        engine = IncidentEngine("CAM_01")
        for i in range(6):
            engine.process_behavior_event(_collision_bev(i * 0.3, 0.9))
        assert not any(i.status == "CONFIRMED"
                       for i in engine.get_active_incidents())


class TestScenarioC:
    """Persistent crowd anomaly → CONFIRMED CROWD_ANOMALY."""

    def test_crowd_confirmed(self) -> None:
        engine = IncidentEngine("CAM_01")
        confirmed = []
        for i in range(7):
            e = bev("CROWD_MOVEMENT_ANOMALY", i * 0.5, [1, 2, 3, 4, 5],
                    ["person"] * 5, 0.7,
                    metadata={"person_count": 10, "relative_density": 0.3})
            for inc in engine.process_behavior_event(e):
                if (inc.status == "CONFIRMED"
                        and inc.incident_type == "CROWD_ANOMALY"):
                    confirmed.append(inc)
        assert confirmed


class TestScenarioF:
    """Short crowd spike → suppressed, never confirmed."""

    def test_transient_spike_no_incident(self) -> None:
        engine = IncidentEngine("CAM_01")
        for i in range(2):
            engine.process_behavior_event(
                bev("CROWD_MOVEMENT_ANOMALY", i * 0.3, [1, 2, 3],
                    ["person"] * 3, 0.7))
        assert not any(i.status == "CONFIRMED"
                       for i in engine.get_active_incidents())


class TestScenarioBAndE:
    """Baggage via the detections path (positional reasoning)."""

    def _frames(self, person_xy, n: int, t0: float = 0.0,
                persons_present: bool = True):
        frames = []
        for i in range(n):
            t = t0 + i * 0.5
            evs = [det(8, 300.0, 300.0, timestamp=t, frame_number=i,
                       class_name="backpack")]
            if persons_present and person_xy is not None:
                evs.append(det(5, *person_xy, timestamp=t, frame_number=i,
                               class_name="person"))
            frames.append(evs)
        return frames

    def test_scenario_b_owner_leaves(self) -> None:
        engine = IncidentEngine("CAM_01")
        # Owner nearby → moves away → leaves view; bag stays put.
        seq = (self._frames((310.0, 310.0), 4)
               + self._frames((600.0, 600.0), 4, t0=2.0)
               + self._frames(None, 22, t0=4.0, persons_present=False))
        confirmed = []
        for frame in seq:
            for inc in engine.process_detections(frame):
                if (inc.status == "CONFIRMED"
                        and inc.incident_type == "UNATTENDED_BAGGAGE"):
                    confirmed.append(inc)
        assert confirmed, "expected CONFIRMED unattended baggage"
        assert confirmed[-1].track_ids and 8 in confirmed[-1].track_ids

    def test_scenario_e_owner_stays(self) -> None:
        engine = IncidentEngine("CAM_01")
        for frame in self._frames((310.0, 310.0), 26):
            engine.process_detections(frame)
        assert not any(
            i.status == "CONFIRMED"
            and i.incident_type == "UNATTENDED_BAGGAGE"
            for i in engine.get_active_incidents())


class TestDedup:
    def test_same_tracks_update_single_incident(self) -> None:
        engine = IncidentEngine("CAM_01")
        events = [
            _collision_bev(0.0, 0.9),
            _collision_bev(0.4, 0.9),
            _collision_bev(0.8, 0.9),
            bev("SUDDEN_STOP", 1.2, [17], ["car"], 0.85),
            bev("SUDDEN_STOP", 1.6, [19], ["car"], 0.85),
            bev("STATIONARY_OBJECT", 2.2, [17], ["car"], 0.8),
            bev("STATIONARY_OBJECT", 2.6, [19], ["car"], 0.8),
        ]
        for e in events:
            engine.process_behavior_event(e)
        accidents = [i for i in engine.get_active_incidents()
                     if i.incident_type == "ACCIDENT"]
        assert len(accidents) == 1  # merged, not duplicated
        # More evidence for the same pair grows the same incident.
        n_evidence = len(accidents[0].evidence)
        assert n_evidence >= 3


class TestLifecycleViaEngine:
    def test_dispatch_and_resolve(self) -> None:
        engine = IncidentEngine("CAM_01")
        for e in [_collision_bev(0.0, 0.9), _collision_bev(0.4, 0.9),
                  _collision_bev(0.8, 0.9),
                  bev("SUDDEN_STOP", 1.2, [17], ["car"], 0.85),
                  bev("SUDDEN_STOP", 1.6, [19], ["car"], 0.85),
                  bev("STATIONARY_OBJECT", 2.2, [17], ["car"], 0.8)]:
            engine.process_behavior_event(e)
        confirmed = [i for i in engine.get_active_incidents()
                     if i.status == "CONFIRMED"]
        assert confirmed
        inc_id = confirmed[0].incident_id
        engine.dispatch_incident(inc_id, "operator dispatch")
        assert engine.get_incident(inc_id).status == "DISPATCHED"
        engine.resolve_incident(inc_id, "cleared")
        assert engine.get_incident(inc_id).status == "RESOLVED"
        with pytest.raises(KeyError):
            engine.resolve_incident("INC-NOPE")

    def test_sweep_expires_stale_candidates(self) -> None:
        engine = IncidentEngine("CAM_01")
        engine.process_behavior_event(_collision_bev(0.0, 0.9))
        expired = engine.sweep(100.0)
        assert any(i.status == "FALSE_ALARM" for i in expired)
