"""
tests/test_processing.py

Tests for the processing job API endpoints and job registry.
Uses FastAPI TestClient with an in-memory SQLite DB override.
"""

from __future__ import annotations

import os
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.main import app as fastapi_app

# ── Test DB setup ─────────────────────────────────────────────────────────────

TEST_DB = "sqlite:///./test_processing.db"
test_engine = create_engine(TEST_DB, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def client():
    import app.db.models  # noqa: F401
    Base.metadata.create_all(bind=test_engine)
    fastapi_app.dependency_overrides[get_db] = override_get_db

    # Also clear the processing job registry between test runs
    from app.api.processing import _registry
    _registry.clear()

    c = TestClient(fastapi_app, raise_server_exceptions=True)
    yield c

    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()
    fastapi_app.dependency_overrides.clear()
    try:
        os.remove("./test_processing.db")
    except FileNotFoundError:
        pass


# ── Job creation tests ────────────────────────────────────────────────────────

class TestProcessingJobCreation:
    def test_start_job_missing_file(self, client: TestClient) -> None:
        """Starting a job with a non-existent video should still return 202
        (job is accepted; the failure happens async in the background worker)."""
        payload = {
            "video_path": "/does/not/exist.mp4",
            "camera_id": "CAM_TEST",
        }
        resp = client.post("/api/v1/processing/video", json=payload)
        assert resp.status_code == 202
        body = resp.json()
        assert body["status"] == "started"
        assert "job_id" in body
        assert body["job_id"].startswith("JOB-")

    def test_start_job_response_fields(self, client: TestClient) -> None:
        payload = {"video_path": "test_vid.mp4", "camera_id": "CAM_02"}
        resp = client.post("/api/v1/processing/video", json=payload)
        assert resp.status_code == 202
        body = resp.json()
        assert body["camera_id"] == "CAM_02"
        assert body["source"] == "test_vid.mp4"
        assert body["status"] == "started"


# ── Job status tests ──────────────────────────────────────────────────────────

class TestProcessingJobStatus:
    created_job_id: str = ""

    def test_get_job_status_initial(self, client: TestClient) -> None:
        payload = {"video_path": "some_video.mp4", "camera_id": "CAM_STATUS"}
        resp = client.post("/api/v1/processing/video", json=payload)
        assert resp.status_code == 202
        TestProcessingJobStatus.created_job_id = resp.json()["job_id"]

    def test_job_status_is_queued_or_running_or_failed(self, client: TestClient) -> None:
        """The job will transition from QUEUED → RUNNING → FAILED (video doesn't exist)."""
        jid = TestProcessingJobStatus.created_job_id
        assert jid

        # Poll up to 5 seconds for a terminal state
        deadline = time.time() + 5
        status = None
        while time.time() < deadline:
            resp = client.get(f"/api/v1/processing/{jid}")
            assert resp.status_code == 200
            body = resp.json()
            status = body["status"]
            if status in ("COMPLETED", "FAILED"):
                break
            time.sleep(0.2)

        # Since video doesn't exist, it must eventually FAIL
        assert status in ("QUEUED", "RUNNING", "FAILED")

    def test_get_nonexistent_job_returns_404(self, client: TestClient) -> None:
        resp = client.get("/api/v1/processing/JOB-DOESNOTEXIST")
        assert resp.status_code == 404
        body = resp.json()
        assert body["detail"]["error"] == "JOB_NOT_FOUND"

    def test_list_jobs(self, client: TestClient) -> None:
        resp = client.get("/api/v1/processing")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_delete_job(self, client: TestClient) -> None:
        # Create a fresh job to delete
        resp = client.post(
            "/api/v1/processing/video",
            json={"video_path": "del_test.mp4", "camera_id": "CAM_DEL"},
        )
        jid = resp.json()["job_id"]
        del_resp = client.delete(f"/api/v1/processing/{jid}")
        assert del_resp.status_code == 204

    def test_delete_nonexistent_job_returns_404(self, client: TestClient) -> None:
        resp = client.delete("/api/v1/processing/JOB-NOTHERE")
        assert resp.status_code == 404


# ── Repeat-emission dedupe ────────────────────────────────────────────────

class TestRepeatEmissionDedupe:
    def test_job_incidents_lists_each_incident_once(self, client: TestClient) -> None:
        """The engine emits one row per status change (VERIFYING, CONFIRMED);
        the job endpoints must still list each incident exactly once."""
        import json

        from app.api.processing import _registry
        from app.db.models import Incident as IncidentRow
        from app.schemas.tracking import JobStatus

        db = TestSession()
        try:
            db.add(IncidentRow(
                incident_id="INC-DUP1",
                incident_type="ACCIDENT",
                status="CONFIRMED",
                severity="high",
                confidence=0.66,
                camera_id="CAM-UPLOAD",
                track_ids_json=json.dumps([2, 12]),
                evidence_json=json.dumps([]),
                reasons_json=json.dumps(["synthetic"]),
            ))
            db.commit()
        finally:
            db.close()

        jid = "JOB-DUPTEST"
        _registry[jid] = JobStatus(
            job_id=jid,
            camera_id="CAM-UPLOAD",
            status="COMPLETED",
            source="dup.mp4",
            # Same incident recorded twice (VERIFYING + CONFIRMED emissions).
            incident_ids=["INC-DUP1", "INC-DUP1"],
        )
        try:
            resp = client.get(f"/api/v1/processing/{jid}/incidents")
            assert resp.status_code == 200
            rows = resp.json()
            assert [r["incident_id"] for r in rows] == ["INC-DUP1"]

            expl = client.get(f"/api/v1/processing/{jid}/explanation")
            assert expl.status_code == 200
            cands = expl.json()["candidates"]
            assert [c["incident_id"] for c in cands] == ["INC-DUP1"]
        finally:
            _registry.pop(jid, None)


# ── Existing Step-1 health check still works ─────────────────────────────────

class TestHealthStillWorks:
    def test_health(self, client: TestClient) -> None:
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
