"""
app/intelligence/fingerprint.py

Incident fingerprinting for cross-camera candidate matching.

The fingerprint hash is a fast pre-filter; actual correlation always uses
evidence (scores in multi_camera.py). A matching hash alone never merges.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

TIME_BUCKET_SECONDS = 60.0


def build_fingerprint(incident) -> dict[str, Any]:
    """Build a candidate-matching fingerprint from an IncidentDetail."""
    classes = sorted({str(c).lower() for c in (incident.class_names or [])})
    evidence_types = sorted({e.type for e in incident.evidence})
    zone = None
    if isinstance(incident.metadata, dict):
        zone = incident.metadata.get("zone")
    time_bucket = int(incident.first_detected_at // TIME_BUCKET_SECONDS)
    return {
        "incident_type": incident.incident_type,
        "zone": zone,
        "time_bucket": time_bucket,
        "classes": classes,
        "track_count": len(incident.track_ids),
        "severity": incident.severity,
        "evidence_types": evidence_types,
    }


def fingerprint_hash(fingerprint: dict[str, Any]) -> str:
    """Stable hash of the coarse fields (type/zone/bucket/classes only)."""
    coarse = {k: fingerprint.get(k) for k in
              ("incident_type", "zone", "time_bucket", "classes")}
    canonical = json.dumps(coarse, sort_keys=True, default=str)
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()[:12]
