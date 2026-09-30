"""
Pytest test suite — Phase 1 backend foundation.

Tests:
1.  GET /api/v1/health                — basic liveness
2.  GET /api/v1/health/db             — database probe
3.  POST /api/v1/cameras              — create camera
4.  GET /api/v1/cameras               — list cameras
5.  GET /api/v1/cameras/{camera_id}   — get single camera
6.  DELETE /api/v1/cameras/{camera_id}— delete camera
7.  GET  /api/v1/cameras/<invalid>    — 404 on unknown camera
8.  DetectionSchema validation        — bbox, confidence, class_name
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import the FastAPI *instance* explicitly — avoid shadowing the `app` package
from app.main import app as fastapi_app
from app.db.database import Base, get_db
from app.schemas.detection import DetectionSchema

# ── In-memory SQLite for tests ────────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite:///./test_sentinel.db"

test_engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def client():
    """
    Set up: create schema in test DB, override DB dependency, yield client.
    Tear down: drop all tables, dispose engine, remove test DB file.
    """
    import app.db.models  # noqa: F401 — register ORM models with Base
    Base.metadata.create_all(bind=test_engine)
    fastapi_app.dependency_overrides[get_db] = override_get_db

    test_client = TestClient(fastapi_app, raise_server_exceptions=True)

    yield test_client

    # Teardown
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()
    fastapi_app.dependency_overrides.clear()
    try:
        os.remove("./test_sentinel.db")
    except FileNotFoundError:
        pass


# ── Health tests ──────────────────────────────────────────────────────────────

class TestHealth:
    def test_liveness(self, client: TestClient) -> None:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["service"] == "civic-eye-backend"
        assert "version" in body

    def test_db_health(self, client: TestClient) -> None:
        response = client.get("/api/v1/health/db")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["database"] == "connected"


# ── Camera CRUD tests ─────────────────────────────────────────────────────────

CAMERA_PAYLOAD = {
    "name": "Test Camera 01",
    "location": "Building A, Entrance",
    "stream_url": "rtsp://192.168.1.10:554/stream1",
    "status": "active",
}


class TestCameras:
    created_camera_id: str = ""

    def test_create_camera(self, client: TestClient) -> None:
        response = client.post("/api/v1/cameras", json=CAMERA_PAYLOAD)
        assert response.status_code == 201
        body = response.json()
        assert body["name"] == CAMERA_PAYLOAD["name"]
        assert body["location"] == CAMERA_PAYLOAD["location"]
        assert "camera_id" in body
        TestCameras.created_camera_id = body["camera_id"]

    def test_list_cameras(self, client: TestClient) -> None:
        response = client.get("/api/v1/cameras")
        assert response.status_code == 200
        cameras = response.json()
        assert isinstance(cameras, list)
        assert len(cameras) >= 1

    def test_get_camera(self, client: TestClient) -> None:
        cid = TestCameras.created_camera_id
        assert cid, "create_camera must run first"
        response = client.get(f"/api/v1/cameras/{cid}")
        assert response.status_code == 200
        body = response.json()
        assert body["camera_id"] == cid

    def test_get_camera_not_found(self, client: TestClient) -> None:
        response = client.get("/api/v1/cameras/DOES_NOT_EXIST")
        assert response.status_code == 404
        body = response.json()
        detail = body.get("detail", body)
        assert detail["error"] == "CAMERA_NOT_FOUND"

    def test_delete_camera(self, client: TestClient) -> None:
        cid = TestCameras.created_camera_id
        assert cid, "create_camera must run first"
        response = client.delete(f"/api/v1/cameras/{cid}")
        assert response.status_code == 204

    def test_get_deleted_camera_returns_404(self, client: TestClient) -> None:
        cid = TestCameras.created_camera_id
        response = client.get(f"/api/v1/cameras/{cid}")
        assert response.status_code == 404


# ── DetectionSchema validation tests ─────────────────────────────────────────

class TestDetectionSchema:
    def test_valid_detection(self) -> None:
        det = DetectionSchema(
            camera_id="CAM_01",
            track_id=1,
            class_name="person",
            confidence=0.95,
            bbox=[10.0, 20.0, 100.0, 200.0],
        )
        assert det.class_name == "person"
        assert det.confidence == 0.95
        assert len(det.bbox) == 4

    def test_invalid_confidence_above_1(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            DetectionSchema(
                camera_id="CAM_01",
                track_id=1,
                class_name="person",
                confidence=1.5,
                bbox=[10.0, 20.0, 100.0, 200.0],
            )

    def test_invalid_confidence_below_0(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            DetectionSchema(
                camera_id="CAM_01",
                track_id=1,
                class_name="person",
                confidence=-0.1,
                bbox=[10.0, 20.0, 100.0, 200.0],
            )

    def test_invalid_bbox_x2_less_than_x1(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            DetectionSchema(
                camera_id="CAM_01",
                track_id=1,
                class_name="person",
                confidence=0.9,
                bbox=[200.0, 20.0, 100.0, 200.0],  # x2 < x1
            )

    def test_invalid_bbox_wrong_length(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            DetectionSchema(
                camera_id="CAM_01",
                track_id=1,
                class_name="person",
                confidence=0.9,
                bbox=[10.0, 20.0, 100.0],  # only 3 elements
            )

    def test_invalid_empty_class_name(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            DetectionSchema(
                camera_id="CAM_01",
                track_id=1,
                class_name="",  # empty
                confidence=0.9,
                bbox=[10.0, 20.0, 100.0, 200.0],
            )
