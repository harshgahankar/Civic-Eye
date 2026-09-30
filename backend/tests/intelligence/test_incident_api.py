"""Incident API: list/filters, detail, evidence, history, dispatch, resolve."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.db.models import Incident, IncidentStatusHistory
from app.main import app


@pytest.fixture()
def client(tmp_path):
    url = f"sqlite:///{tmp_path}/test_api.db"
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
    # Seed two incidents: one verifying accident, one confirmed baggage.
    db = factory()
    try:
        db.add(Incident(incident_id="INC-TEST-1", incident_type="ACCIDENT",
                        severity="high", confidence=0.8, status="VERIFYING",
                        camera_id="CAM_01", track_ids_json="[17, 19]",
                        evidence_json="[]"))
        db.add(Incident(incident_id="INC-TEST-2",
                        incident_type="UNATTENDED_BAGGAGE",
                        severity="medium", confidence=0.65,
                        status="CONFIRMED", camera_id="CAM_02",
                        track_ids_json="[8]", evidence_json="[]"))
        db.commit()
    finally:
        db.close()
    yield TestClient(app)
    app.dependency_overrides.clear()
    engine.dispose()


class TestIncidentApi:
    def test_list(self, client) -> None:
        r = client.get("/api/v1/incidents")
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_filter_camera(self, client) -> None:
        r = client.get("/api/v1/incidents", params={"camera_id": "CAM_02"})
        assert r.status_code == 200
        assert [i["incident_id"] for i in r.json()] == ["INC-TEST-2"]

    def test_filter_status(self, client) -> None:
        r = client.get("/api/v1/incidents", params={"status": "CONFIRMED"})
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_pagination(self, client) -> None:
        r = client.get("/api/v1/incidents", params={"limit": 1, "offset": 0})
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_active(self, client) -> None:
        r = client.get("/api/v1/incidents/active")
        assert r.status_code == 200
        assert len(r.json()) == 2  # VERIFYING + CONFIRMED are active

    def test_detail(self, client) -> None:
        r = client.get("/api/v1/incidents/INC-TEST-1")
        assert r.status_code == 200
        assert r.json()["incident_type"] == "ACCIDENT"

    def test_detail_404(self, client) -> None:
        r = client.get("/api/v1/incidents/INC-NOPE")
        assert r.status_code == 404
        assert r.json()["detail"]["error"] == "INCIDENT_NOT_FOUND"

    def test_evidence_empty(self, client) -> None:
        r = client.get("/api/v1/incidents/INC-TEST-1/evidence")
        assert r.status_code == 200
        assert r.json() == []

    def test_history_empty(self, client) -> None:
        r = client.get("/api/v1/incidents/INC-TEST-1/history")
        assert r.status_code == 200
        assert r.json() == []

    def test_invalid_dispatch_rejected(self, client) -> None:
        # VERIFYING → DISPATCHED skips CONFIRMED → 409.
        r = client.post("/api/v1/incidents/INC-TEST-1/dispatch", json={})
        assert r.status_code == 409
        assert r.json()["detail"]["error"] == "INVALID_TRANSITION"

    def test_resolve_verifying_marks_false_alarm(self, client) -> None:
        r = client.post("/api/v1/incidents/INC-TEST-1/resolve",
                        json={"reason": "operator review"})
        assert r.status_code == 200
        assert r.json()["status"] == "FALSE_ALARM"

    def test_dispatch_confirmed_then_resolve(self, client) -> None:
        r = client.post("/api/v1/incidents/INC-TEST-2/dispatch", json={})
        assert r.status_code == 200
        assert r.json()["status"] == "DISPATCHED"
        r = client.post("/api/v1/incidents/INC-TEST-2/resolve", json={})
        assert r.status_code == 200
        assert r.json()["status"] == "RESOLVED"
        # History recorded.
        r = client.get("/api/v1/incidents/INC-TEST-2/history")
        assert [h["new_status"] for h in r.json()] == ["DISPATCHED", "RESOLVED"]
