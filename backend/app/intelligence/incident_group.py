"""
app/intelligence/incident_group.py

Incident groups: one real-world event observed by multiple cameras.

A group never destroys underlying evidence — members keep their original
IDs, cameras, timestamps and evidence; the group only links them with the
correlation confidence that joined them.
"""
from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


def _new_group_id() -> str:
    return f"GRP-{uuid.uuid4().hex[:8].upper()}"


class GroupMember(BaseModel):
    incident_id: str
    camera_id: str
    correlation_score: float = Field(..., ge=0.0, le=1.0)


class IncidentGroup(BaseModel):
    group_id: str = Field(default_factory=_new_group_id)
    primary_incident_id: str
    primary_camera_id: str
    member_incidents: list[GroupMember] = Field(default_factory=list)
    related_camera_ids: list[str] = Field(default_factory=list)
    start_time: float = 0.0
    last_updated: float = 0.0
    severity: str = "LOW"
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    status: str = "OPEN"
    timeline: list[dict[str, Any]] = Field(default_factory=list)

    @property
    def all_incident_ids(self) -> list[str]:
        ids = [self.primary_incident_id]
        ids.extend(m.incident_id for m in self.member_incidents
                   if m.incident_id != self.primary_incident_id)
        return ids
