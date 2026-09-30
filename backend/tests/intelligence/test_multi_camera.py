"""Multi-camera fusion: correlation, grouping, negative case, timeline.

Topology: CAM-01 → CAM-02 (7s) → CAM-03.
Scenario: T=100 CAM-01 ACCIDENT, T=107 CAM-02 related, T=111 CAM-03 aftermath.
Negative: CAM-01 ACCIDENT T=100 vs CAM-03 ACCIDENT T=300, no relation.
"""
from __future__ import annotations

from app.events import event_types
from app.events.event_bus import EventBus
from app.intelligence.multi_camera import MultiCameraFusionEngine
from app.schemas.incident import IncidentDetail
from tests.intelligence.helpers import ev_item


def _topology():
    edges = {("CAM-01", "CAM-02"): 7.0, ("CAM-02", "CAM-03"): 4.0}

    def provider(a: str, b: str):
        if (a, b) in edges:
            return True, edges[(a, b)]
        if (b, a) in edges:
            return True, edges[(b, a)]
        return False, None

    return provider


def _zones():
    return {"CAM-01": "HIGHWAY_A", "CAM-02": "HIGHWAY_A",
            "CAM-03": "HIGHWAY_A"}.get


def _accident(camera: str, t0: float, conf: float = 0.85,
              tracks=(17, 19)) -> IncidentDetail:
    inc = IncidentDetail(
        camera_id=camera, incident_type="ACCIDENT", status="CONFIRMED",
        severity="HIGH", confidence=conf, first_detected_at=t0,
        last_updated_at=t0 + 2.0, track_ids=list(tracks),
        class_names=["car", "car"])
    inc.evidence = [ev_item("POSSIBLE_COLLISION", t0, conf, list(tracks)),
                    ev_item("SUDDEN_STOP", t0 + 1.0, 0.8, [tracks[0]]),
                    ev_item("STATIONARY_OBJECT", t0 + 2.0, 0.8,
                            [tracks[0]])]
    return inc


class TestCorrelationScoring:
    def test_same_type_increases_score(self) -> None:
        engine = MultiCameraFusionEngine(
            topology_provider=_topology(), zone_provider=_zones())
        a = _accident("CAM-01", 100.0)
        b = _accident("CAM-02", 107.0)
        c = _accident("CAM-02", 107.0, tracks=(17, 19))
        c.incident_type = "CROWD_ANOMALY"
        assert (engine.calculate_correlation_score(a, b)
                > engine.calculate_correlation_score(a, c))

    def test_topology_awareness(self) -> None:
        engine = MultiCameraFusionEngine(
            topology_provider=_topology(), zone_provider=_zones())
        a = _accident("CAM-01", 100.0)
        near = _accident("CAM-02", 107.0)
        far = _accident("CAM-09", 107.0)  # unrelated camera
        assert (engine.calculate_correlation_score(a, near)
                > engine.calculate_correlation_score(a, far))

    def test_temporal_decay(self) -> None:
        engine = MultiCameraFusionEngine(
            topology_provider=_topology(), zone_provider=_zones())
        a = _accident("CAM-01", 100.0)
        assert (engine.calculate_correlation_score(a, _accident("CAM-02",
                                                                107.0))
                > engine.calculate_correlation_score(a, _accident("CAM-02",
                                                                  114.0)))


class TestSyntheticScenario:
    def test_group_forms_and_preserves_originals(self) -> None:
        bus = EventBus()
        seen: list = []
        bus.subscribe(seen.append)
        engine = MultiCameraFusionEngine(
            topology_provider=_topology(), zone_provider=_zones(),
            on_merge=lambda group, primary: bus.publish(
                event_types.INCIDENT_MERGED,
                {"group_id": group.group_id}, source="fusion_engine",
                camera_id=primary.camera_id,
                incident_id=primary.incident_id))

        inc1 = _accident("CAM-01", 100.0)
        assert engine.process_incident(inc1) is None  # first: no partner yet
        inc2 = _accident("CAM-02", 107.0)
        group = engine.process_incident(inc2)
        assert group is not None
        # Unified group links both cameras; originals preserved.
        assert group.primary_incident_id == inc1.incident_id
        assert set(group.related_camera_ids) == {"CAM-01", "CAM-02"}
        assert inc1.related_incident_ids == [inc2.incident_id]
        assert inc1.correlation_confidence is not None
        assert len(inc1.evidence) == 3  # untouched
        assert len(inc2.evidence) == 3  # untouched
        # Timeline chronological from actual events.
        stamps = [e["timestamp"] for e in group.timeline]
        assert stamps == sorted(stamps)
        assert len(group.timeline) >= 6  # 3+3 evidence entries minimum
        # Merge event published.
        assert any(e.event_type == event_types.INCIDENT_MERGED
                   for e in seen)

    def test_negative_case_no_merge(self) -> None:
        def zones(cam: str):
            return {"CAM-01": "ZONE_A", "CAM-03": "ZONE_B"}.get(cam)

        engine = MultiCameraFusionEngine(
            topology_provider=lambda a, b: (False, None),
            zone_provider=zones)
        a = _accident("CAM-01", 100.0)
        a.class_names = ["car", "car"]
        engine.process_incident(a)
        b = _accident("CAM-03", 300.0)  # far apart, no relation, other zone
        b.class_names = ["truck"]
        assert engine.process_incident(b) is None
        assert engine.all_groups() == []
