"""Incident fingerprinting: stable, coarse, deterministic."""
from __future__ import annotations

from app.intelligence.fingerprint import build_fingerprint, fingerprint_hash
from app.schemas.incident import IncidentDetail


def _incident(**kw) -> IncidentDetail:
    base = {"camera_id": "CAM-01", "incident_type": "ACCIDENT",
            "confidence": 0.8, "first_detected_at": 100.0,
            "last_updated_at": 101.0}
    base.update(kw)
    return IncidentDetail(**base)


class TestFingerprint:
    def test_fields(self) -> None:
        inc = _incident(class_names=["car", "car"])
        fp = build_fingerprint(inc)
        assert fp["incident_type"] == "ACCIDENT"
        assert fp["classes"] == ["car"]
        assert fp["time_bucket"] == int(100.0 // 60.0)

    def test_same_bucket_same_hash(self) -> None:
        a = fingerprint_hash(build_fingerprint(_incident()))
        b = fingerprint_hash(build_fingerprint(
            _incident(first_detected_at=105.0)))
        assert a == b  # same 60s bucket

    def test_different_type_different_hash(self) -> None:
        a = fingerprint_hash(build_fingerprint(_incident()))
        b = fingerprint_hash(build_fingerprint(
            _incident(incident_type="CROWD_ANOMALY")))
        assert a != b

    def test_hash_is_coarse_not_decisive(self) -> None:
        # Same hash can still differ in severity/evidence — hash is a
        # pre-filter only.
        a = build_fingerprint(_incident())
        b = build_fingerprint(_incident(severity="CRITICAL"))
        assert fingerprint_hash(a) == fingerprint_hash(b)
        assert a["severity"] != b["severity"]
