"""Lifecycle state machine: valid paths pass, invalid paths rejected."""
from __future__ import annotations

import pytest

from app.intelligence.lifecycle import (
    InvalidTransitionError,
    allowed_transitions,
    transition,
)


class TestLifecycle:
    def test_full_valid_path(self) -> None:
        history: list = []
        t1 = transition("DETECTED", "VERIFYING", "review", history)
        t2 = transition("VERIFYING", "CONFIRMED", "evidence met", history)
        t3 = transition("CONFIRMED", "DISPATCHED", "team sent", history)
        t4 = transition("DISPATCHED", "RESOLVED", "done", history)
        assert [t.new_status for t in (t1, t2, t3, t4)] == [
            "VERIFYING", "CONFIRMED", "DISPATCHED", "RESOLVED"]
        assert len(history) == 4

    def test_verifying_to_false_alarm(self) -> None:
        t = transition("VERIFYING", "FALSE_ALARM", "weak evidence")
        assert t.new_status == "FALSE_ALARM"

    def test_confirmed_to_resolved(self) -> None:
        t = transition("CONFIRMED", "RESOLVED", "cleared")
        assert t.new_status == "RESOLVED"

    @pytest.mark.parametrize("frm,to", [
        ("DETECTED", "CONFIRMED"),   # must verify first
        ("DETECTED", "RESOLVED"),
        ("VERIFYING", "DISPATCHED"),  # must confirm first
        ("VERIFYING", "RESOLVED"),
        ("CONFIRMED", "VERIFYING"),   # no going backwards
        ("RESOLVED", "CONFIRMED"),    # terminal
        ("FALSE_ALARM", "CONFIRMED"),  # terminal
        ("DISPATCHED", "CONFIRMED"),
    ])
    def test_invalid_transitions_rejected(self, frm: str, to: str) -> None:
        with pytest.raises(InvalidTransitionError):
            transition(frm, to, "should fail")

    def test_allowed_transitions(self) -> None:
        assert allowed_transitions("DETECTED") == {"VERIFYING"}
        assert allowed_transitions("RESOLVED") == set()
