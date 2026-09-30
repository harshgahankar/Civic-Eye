"""Camera topology: create, neighbors, validation, graph."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.services.camera_topology import (
    add_relationship,
    are_related,
    get_neighbors,
    get_topology,
    transition_estimate,
)


@pytest.fixture()
def db(tmp_path):
    url = f"sqlite:///{tmp_path}/test_topo.db"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = factory()
    yield session
    session.close()
    engine.dispose()


class TestTopology:
    def test_create_and_neighbors(self, db) -> None:
        add_relationship(db, "CAM-01", "CAM-02", "ADJACENT", 7.0)
        neighbors = get_neighbors(db, "CAM-01")
        assert len(neighbors) == 1
        assert neighbors[0].target_camera_id == "CAM-02"
        assert neighbors[0].estimated_transition_seconds == 7.0
        assert get_neighbors(db, "CAM-02") == []  # directed

    def test_self_relationship_rejected(self, db) -> None:
        with pytest.raises(ValueError):
            add_relationship(db, "CAM-01", "CAM-01")

    def test_invalid_type_rejected(self, db) -> None:
        with pytest.raises(ValueError):
            add_relationship(db, "CAM-01", "CAM-02", "WORMHOLE")

    def test_empty_id_rejected(self, db) -> None:
        with pytest.raises(ValueError):
            add_relationship(db, "", "CAM-02")

    def test_duplicate_rejected(self, db) -> None:
        add_relationship(db, "CAM-01", "CAM-02")
        with pytest.raises(ValueError, match="already exists"):
            add_relationship(db, "CAM-01", "CAM-02")

    def test_bad_confidence_rejected(self, db) -> None:
        with pytest.raises(ValueError):
            add_relationship(db, "CAM-01", "CAM-02", confidence=2.0)

    def test_topology_graph(self, db) -> None:
        add_relationship(db, "CAM-01", "CAM-02", "SEQUENTIAL", 7.0)
        add_relationship(db, "CAM-02", "CAM-03", "SEQUENTIAL", 4.0)
        topo = get_topology(db)
        assert topo["CAM-01"].neighbors == ["CAM-02"]
        assert topo["CAM-02"].neighbors == ["CAM-03"]
        assert topo["CAM-01"].estimated_transition_seconds == {"CAM-02": 7.0}

    def test_transition_estimate_and_related(self, db) -> None:
        add_relationship(db, "CAM-01", "CAM-02", "ADJACENT", 7.0)
        assert transition_estimate(db, "CAM-01", "CAM-02") == 7.0
        assert transition_estimate(db, "CAM-01", "CAM-09") == 15.0
        assert are_related(db, "CAM-01", "CAM-02") is True
        assert are_related(db, "CAM-02", "CAM-01") is True  # either direction
        assert are_related(db, "CAM-01", "CAM-09") is False
