"""Incident groups: structure, membership, severity promotion."""
from __future__ import annotations

from app.intelligence.incident_group import GroupMember, IncidentGroup


class TestIncidentGroup:
    def test_all_incident_ids(self) -> None:
        group = IncidentGroup(
            primary_incident_id="INC-1", primary_camera_id="CAM-01",
            member_incidents=[
                GroupMember(incident_id="INC-1", camera_id="CAM-01",
                            correlation_score=1.0),
                GroupMember(incident_id="INC-2", camera_id="CAM-02",
                            correlation_score=0.87)])
        assert group.all_incident_ids == ["INC-1", "INC-2"]

    def test_group_ids_unique(self) -> None:
        a = IncidentGroup(primary_incident_id="INC-1",
                          primary_camera_id="CAM-01")
        b = IncidentGroup(primary_incident_id="INC-1",
                          primary_camera_id="CAM-01")
        assert a.group_id != b.group_id
        assert a.group_id.startswith("GRP-")

    def test_member_score_bounded(self) -> None:
        import pydantic
        import pytest
        with pytest.raises(pydantic.ValidationError):
            GroupMember(incident_id="INC-1", camera_id="CAM-01",
                        correlation_score=1.5)
