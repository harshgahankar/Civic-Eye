"""Step-5 API surface: topology, health, dashboard snapshot, recent events."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.db.models import Incident
from app.events import event_types, get_default_bus
from app.main import app
from app.services.camera_health import get_health_service


@pytest.fixture()
def client(tmp_path):
    url = f"sqlite:///{tmp_path}/test_step5.db"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    def _override():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    db = factory()
    try:
        db.add(Incident(incident_id="INC-S5-1", incident_type="ACCIDENT",
                        severity="high", confidence=0.8, status="CONFIRMED",
                        camera_id="CAM-01", track_ids_json="[1, 2]",
                        evidence_json="[]"))
        db.commit()
    finally:
        db.close()
    get_health_service().reset()
    get_default_bus().reset()
    yield TestClient(app)
    app.dependency_overrides.clear()
    get_health_service().reset()
    get_default_bus().reset()
    engine.dispose()


class TestTopologyApi:
    def test_empty_topology(self, client) -> None:
        r = client.get("/api/v1/cameras/topology")
        assert r.status_code == 200
        assert r.json() == {"cameras": {}}

    def test_add_and_list_neighbors(self, client) -> None:
        r = client.post("/api/v1/cameras/CAM-01/neighbors", json={
            "target_camera_id": "CAM-02",
            "relationship_type": "SEQUENTIAL",
            "estimated_transition_seconds": 7.0})
        assert r.status_code == 201
        r = client.get("/api/v1/cameras/CAM-01/neighbors")
        assert r.status_code == 200
        assert r.json()[0]["target_camera_id"] == "CAM-02"
        r = client.get("/api/v1/cameras/topology")
        assert r.json()["cameras"]["CAM-01"]["neighbors"] == ["CAM-02"]

    def test_duplicate_409(self, client) -> None:
        payload = {"target_camera_id": "CAM-02"}
        client.post("/api/v1/cameras/CAM-01/neighbors", json=payload)
        r = client.post("/api/v1/cameras/CAM-01/neighbors", json=payload)
        assert r.status_code == 409

    def test_invalid_relationship_422(self, client) -> None:
        r = client.post("/api/v1/cameras/CAM-01/neighbors", json={
            "target_camera_id": "CAM-01"})  # self-link
        assert r.status_code == 422


class TestHealthApi:
    def test_empty_health(self, client) -> None:
        r = client.get("/api/v1/cameras/health")
        assert r.status_code == 200
        assert r.json() == {"cameras": []}

    def test_unknown_camera_404(self, client) -> None:
        r = client.get("/api/v1/cameras/CAM-NOPE/health")
        assert r.status_code == 404

    def test_reported_camera_visible(self, client) -> None:
        get_health_service().report_frame("CAM-01", fps=20.0)
        r = client.get("/api/v1/cameras/CAM-01/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ONLINE"


class TestDashboardApi:
    def test_snapshot(self, client) -> None:
        get_health_service().report_frame("CAM-01", fps=20.0)
        r = client.get("/api/v1/dashboard/snapshot")
        assert r.status_code == 200
        body = r.json()
        assert body["active_incidents"] == 1
        assert body["high_incidents"] == 1
        assert body["critical_incidents"] == 0
        assert body["cameras_online"] == 1
        assert len(body["recent_incidents"]) == 1
        assert "system_timestamp" in body

    def test_recent_events(self, client) -> None:
        bus = get_default_bus()
        bus.publish(event_types.INCIDENT_CREATED,
                    {"incident_type": "ACCIDENT", "severity": "HIGH"},
                    source="t", camera_id="CAM-01", incident_id="INC-X")
        r = client.get("/api/v1/events/recent")
        assert r.status_code == 200
        assert r.json()[-1]["incident_id"] == "INC-X"
        r = client.get("/api/v1/events/recent",
                       params={"camera_id": "CAM-02"})
        assert r.json() == []
        r = client.get("/api/v1/events/recent",
                       params={"severity": "HIGH"})
        assert len(r.json()) == 1
