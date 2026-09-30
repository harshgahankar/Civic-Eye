"""Severity classification: deterministic, bounded, documented."""
from __future__ import annotations

from app.intelligence.severity import classify_severity


class TestSeverity:
    def test_minor_single_vehicle_is_low_or_medium(self) -> None:
        s = classify_severity("ACCIDENT", 0.4, track_count=1,
                              evidence_count=2, span_seconds=0.5)
        assert s.severity in ("LOW", "MEDIUM")

    def test_confirmed_multi_vehicle_is_high(self) -> None:
        s = classify_severity("ACCIDENT", 0.85, track_count=2,
                              evidence_count=7, span_seconds=3.0)
        assert s.severity in ("HIGH", "CRITICAL")

    def test_long_unattended_bag_in_roi_escalates(self) -> None:
        plain = classify_severity("UNATTENDED_BAGGAGE", 0.7, track_count=1,
                                  evidence_count=5, span_seconds=30.0)
        roi = classify_severity("UNATTENDED_BAGGAGE", 0.7, track_count=1,
                                evidence_count=5, span_seconds=30.0,
                                in_sensitive_roi=True)
        assert roi.severity_score >= plain.severity_score

    def test_deterministic(self) -> None:
        kw = dict(incident_type="CROWD_ANOMALY", confidence=0.7,
                  track_count=8, evidence_count=6, span_seconds=4.0,
                  person_count=15)
        assert classify_severity(**kw) == classify_severity(**kw)

    def test_score_bounded(self) -> None:
        s = classify_severity("ACCIDENT", 1.0, track_count=10,
                              evidence_count=50, span_seconds=100.0,
                              person_count=50, in_sensitive_roi=True)
        assert 0.0 <= s.severity_score <= 1.0
        assert s.severity == "CRITICAL"

    def test_reasons_documented(self) -> None:
        s = classify_severity("ACCIDENT", 0.6, track_count=2,
                              evidence_count=4, span_seconds=2.0)
        assert len(s.reasons) >= 2
