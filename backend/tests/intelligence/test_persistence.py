"""SQLite persistence: incident, evidence rows, status history rows."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.db.database as _db_module
from app.db.database import Base
from app.db.models import Incident, IncidentEvidence, IncidentStatusHistory
from app.intelligence.persistence import upsert_incident
from app.schemas.incident import IncidentDetail, StatusTransition


@pytest.fixture()
def tmp_session(monkeypatch, tmp_path):
    url = f"sqlite:///{tmp_path}/test_incidents.db"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    monkeypatch.setattr(_db_module, "SessionLocal", factory)
    yield factory
    engine.dispose()


def _detail() -> IncidentDetail:
    return IncidentDetail(
        camera_id="CAM_01", incident_type="ACCIDENT", status="CONFIRMED",
        severity="HIGH", confidence=0.82, first_detected_at=21.42,
        last_updated_at=24.10, track_ids=[17, 19],
        reasons=["vehicle trajectory convergence"],
        recommended_action="Dispatch traffic response team",
        metadata={"severity_score": 0.8},
    )


class TestPersistence:
    def test_upsert_stores_incident(self, tmp_session) -> None:
        assert upsert_incident(_detail()) is True
        db = tmp_session()
        try:
            row = db.query(Incident).filter(
                Incident.incident_id == _detail().incident_id).first()
            # incident_id is random; fetch the single row instead.
            rows = db.query(Incident).all()
            assert len(rows) == 1
            assert rows[0].camera_id == "CAM_01"
            assert rows[0].status == "CONFIRMED"
            assert rows[0].severity == "high"
        finally:
            db.close()

    def test_evidence_rows_stored(self, tmp_session) -> None:
        from tests.intelligence.helpers import ev_item
        detail = _detail()
        detail.evidence = [ev_item("POSSIBLE_COLLISION", 21.42, 0.91, [17, 19]),
                           ev_item("SUDDEN_STOP", 21.67, 0.88, [17])]
        assert upsert_incident(detail) is True
        db = tmp_session()
        try:
            rows = db.query(IncidentEvidence).filter(
                IncidentEvidence.incident_id == detail.incident_id).all()
            assert len(rows) == 2
            assert {r.event_type for r in rows} == {
                "POSSIBLE_COLLISION", "SUDDEN_STOP"}
        finally:
            db.close()

    def test_status_history_stored(self, tmp_session) -> None:
        from datetime import datetime, timezone
        detail = _detail()
        history = [StatusTransition(previous_status="DETECTED",
                                    new_status="VERIFYING",
                                    timestamp=datetime.now(timezone.utc),
                                    reason="review"),
                   StatusTransition(previous_status="VERIFYING",
                                    new_status="CONFIRMED",
                                    timestamp=datetime.now(timezone.utc),
                                    reason="evidence met")]
        assert upsert_incident(detail, history) is True
        db = tmp_session()
        try:
            rows = (db.query(IncidentStatusHistory)
                    .filter(IncidentStatusHistory.incident_id
                            == detail.incident_id)
                    .order_by(IncidentStatusHistory.id.asc()).all())
            assert [r.new_status for r in rows] == ["VERIFYING", "CONFIRMED"]
            # Re-upsert appends only new records (no duplicates).
            assert upsert_incident(detail, history) is True
            rows2 = db.query(IncidentStatusHistory).filter(
                IncidentStatusHistory.incident_id == detail.incident_id).all()
            assert len(rows2) == 2
        finally:
            db.close()
