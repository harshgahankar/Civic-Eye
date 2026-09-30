"""
app/intelligence/lifecycle.py

Auditable incident state machine.

Valid transitions:

    DETECTED   → VERIFYING
    VERIFYING  → CONFIRMED | FALSE_ALARM
    CONFIRMED  → DISPATCHED | RESOLVED
    DISPATCHED → RESOLVED

Every transition records (previous, new, timestamp, reason).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from app.schemas.incident import StatusTransition

_VALID: dict[str, set[str]] = {
    "DETECTED": {"VERIFYING"},
    "VERIFYING": {"CONFIRMED", "FALSE_ALARM"},
    "CONFIRMED": {"DISPATCHED", "RESOLVED"},
    "DISPATCHED": {"RESOLVED"},
    "RESOLVED": set(),
    "FALSE_ALARM": set(),
}


class InvalidTransitionError(ValueError):
    """Raised when a lifecycle transition is not allowed."""


def allowed_transitions(status: str) -> set[str]:
    return set(_VALID.get(status.upper(), set()))


def transition(
    current: str,
    new: str,
    reason: str = "",
    history: List[StatusTransition] | None = None,
) -> StatusTransition:
    """Validate and record a lifecycle transition (raises on invalid)."""
    current_u, new_u = current.upper(), new.upper()
    if new_u not in _VALID.get(current_u, set()):
        raise InvalidTransitionError(
            f"Invalid incident transition: {current_u} → {new_u}"
        )
    record = StatusTransition(
        previous_status=current_u,
        new_status=new_u,
        timestamp=datetime.now(timezone.utc),
        reason=reason,
    )
    if history is not None:
        history.append(record)
    return record
