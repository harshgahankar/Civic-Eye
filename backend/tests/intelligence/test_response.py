"""Response recommendations map type+severity; advisory-only wording."""
from __future__ import annotations

from app.intelligence.response import recommend


class TestResponse:
    def test_accident_high(self) -> None:
        r = recommend("ACCIDENT", "HIGH")
        assert "traffic response" in r.recommended_action.lower()
        assert r.recommended_priority == "P1"

    def test_baggage_high(self) -> None:
        r = recommend("UNATTENDED_BAGGAGE", "HIGH")
        assert "security" in r.recommended_action.lower()

    def test_crowd_high(self) -> None:
        r = recommend("CROWD_ANOMALY", "HIGH")
        assert "crowd" in r.recommended_action.lower()

    def test_low_severity_monitoring(self) -> None:
        r = recommend("CROWD_ANOMALY", "LOW")
        assert r.recommended_action == "Continue monitoring."
        assert r.recommended_priority == "P4"

    def test_advisory_only_never_claims_dispatch(self) -> None:
        for itype in ("ACCIDENT", "UNATTENDED_BAGGAGE", "CROWD_ANOMALY"):
            for sev in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
                r = recommend(itype, sev)
                text = (r.recommended_action + " ".join(r.reasons)).lower()
                assert "have been contacted" not in text
                assert "has been dispatched" not in text
                assert "emergency services contacted" not in text
