"""Accident path must ignore person-only signals (crowd zigzags/stops).

Regression test: a crowded scene emits TRAJECTORY_ANOMALY / SUDDEN_STOP /
STATIONARY_OBJECT for person tracks. None of these may open an ACCIDENT
candidate. Vehicle signals keep working as before.
"""
from __future__ import annotations

from app.intelligence.incident_engine import IncidentEngine
from tests.intelligence.helpers import bev


def _feed(engine: IncidentEngine, event_type: str, classes: list[str], n: int = 5):
    out = []
    for i in range(n):
        out.extend(
            engine.process_behavior_events([
                bev(event_type, timestamp=float(i), track_ids=[100 + i],
                    class_names=[classes[0]] * 1, camera_id="CAM-01"),
            ])
        )
    return out


def test_person_trajectory_anomaly_opens_nothing():
    engine = IncidentEngine(camera_id="CAM-01")
    changed = _feed(engine, "TRAJECTORY_ANOMALY", ["person"])
    assert changed == []
    assert engine.get_active_incidents() == []


def test_person_sudden_stop_opens_nothing():
    engine = IncidentEngine(camera_id="CAM-01")
    changed = _feed(engine, "SUDDEN_STOP", ["person"])
    assert changed == []
    assert engine.get_active_incidents() == []


def test_person_stationary_opens_nothing():
    engine = IncidentEngine(camera_id="CAM-01")
    changed = _feed(engine, "STATIONARY_OBJECT", ["person"])
    assert changed == []
    assert engine.get_active_incidents() == []


def test_vehicle_signals_still_open_candidates():
    engine = IncidentEngine(camera_id="CAM-01")
    changed = []
    for i in range(3):
        changed.extend(
            engine.process_behavior_events([
                bev("SUDDEN_STOP", timestamp=float(i), track_ids=[17],
                    class_names=["car"], camera_id="CAM-01"),
            ])
        )
    actives = engine.get_active_incidents()
    assert len(actives) == 1
    assert actives[0].incident_type == "ACCIDENT"
    assert changed  # VERIFYING candidate emitted


def test_mixed_person_and_vehicle_only_vehicle_counts():
    engine = IncidentEngine(camera_id="CAM-01")
    for i in range(4):
        engine.process_behavior_events([
            bev("TRAJECTORY_ANOMALY", timestamp=float(i), track_ids=[200 + i],
                class_names=["person"], camera_id="CAM-01"),
            bev("SUDDEN_STOP", timestamp=float(i), track_ids=[300],
                class_names=["car"], camera_id="CAM-01"),
        ])
    actives = engine.get_active_incidents()
    assert len(actives) == 1
    assert actives[0].track_ids == [300]
