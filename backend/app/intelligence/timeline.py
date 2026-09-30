"""
app/intelligence/timeline.py

Auditable unified timelines built from actual events — never hardcoded.
Merges per-incident evidence, status transitions and merge records, sorted
chronologically.
"""
from __future__ import annotations

from typing import Any


def build_timeline(
    incidents: list,
    histories: dict[str, list] | None = None,
    merges: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Build a chronological timeline from real incident data.

    incidents : IncidentDetail list (evidence → entries)
    histories : {incident_id: [StatusTransition]} (transitions → entries)
    merges    : [{"timestamp": ..., "primary": ..., "merged": ..., "score"}]
    """
    entries: list[dict[str, Any]] = []
    for inc in incidents:
        for ev in inc.evidence:
            entries.append({
                "timestamp": ev.timestamp,
                "camera_id": inc.camera_id,
                "incident_id": inc.incident_id,
                "kind": "evidence",
                "summary": _describe_evidence(ev),
            })
    for incident_id, records in (histories or {}).items():
        cam = next((i.camera_id for i in incidents
                    if i.incident_id == incident_id), None)
        for record in records:
            ts = record.timestamp
            ts_value = ts.timestamp() if hasattr(ts, "timestamp") else float(ts)
            entries.append({
                "timestamp": ts_value,
                "camera_id": cam,
                "incident_id": incident_id,
                "kind": "status",
                "summary": (f"status {record.previous_status} → "
                            f"{record.new_status}: {record.reason}"),
            })
    for merge in merges or []:
        entries.append({
            "timestamp": float(merge.get("timestamp", 0.0)),
            "camera_id": None,
            "incident_id": merge.get("primary"),
            "kind": "merge",
            "summary": (f"correlated with {merge.get('merged')} "
                        f"(score {merge.get('score', 0.0):.2f})"),
        })
    entries.sort(key=lambda e: (e["timestamp"], e["kind"]))
    return entries


def _describe_evidence(ev) -> str:
    label = ev.type.lower().replace("_", " ")
    return (f"{label} observed "
            f"(confidence score {ev.confidence:.2f}, "
            f"tracks {list(ev.track_ids)})")
