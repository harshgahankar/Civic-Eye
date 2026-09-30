"""Unified timeline: chronological, sourced from real events."""
from __future__ import annotations

from datetime import datetime, timezone

from app.intelligence.timeline import build_timeline
from app.schemas.incident import IncidentDetail, StatusTransition
from tests.intelligence.helpers import ev_item


class TestTimeline:
    def test_chronological_from_evidence(self) -> None:
        inc = IncidentDetail(
            camera_id="CAM-01", incident_type="ACCIDENT",
            confidence=0.8, first_detected_at=10.0, last_updated_at=14.0)
        inc.evidence = [ev_item("STATIONARY_OBJECT", 14.0, 0.8, [17]),
                        ev_item("POSSIBLE_COLLISION", 10.0, 0.9, [17, 19])]
        timeline = build_timeline([inc])
        assert [e["timestamp"] for e in timeline] == [10.0, 14.0]
        assert timeline[0]["camera_id"] == "CAM-01"

    def test_status_and_merge_entries(self) -> None:
        inc = IncidentDetail(
            camera_id="CAM-02", incident_type="ACCIDENT",
            confidence=0.8, first_detected_at=20.0, last_updated_at=22.0)
        history = {"X": [StatusTransition(
            previous_status="VERIFYING", new_status="CONFIRMED",
            timestamp=datetime.fromtimestamp(21.0, tz=timezone.utc),
            reason="evidence met")]}
        timeline = build_timeline(
            [inc], histories=history,
            merges=[{"timestamp": 25.0, "primary": "X",
                     "merged": "Y", "score": 0.87}])
        kinds = [e["kind"] for e in timeline]
        assert "status" in kinds and "merge" in kinds
        assert timeline[-1]["kind"] == "merge"

    def test_empty(self) -> None:
        assert build_timeline([]) == []
