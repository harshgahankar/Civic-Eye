"""
app/intelligence/temporal_verifier.py

Temporal verification: a single behavior signal must NEVER become a
confirmed incident on its own. Evidence must accumulate across frames
inside a configurable time window with minimum count and confidence.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Tuple

from app.core.config import settings
from app.schemas.incident import EvidenceItem

from app.intelligence.evidence import EvidenceBuffer


@dataclass
class VerificationResult:
    verified: bool
    evidence_count: int
    mean_confidence: float
    span_seconds: float
    reason: str


class TemporalVerifier:
    """Per-key temporal evidence gate with cooldown + duplicate suppression."""

    def __init__(
        self,
        window_seconds: float | None = None,
        min_evidence: int = 3,
        min_mean_confidence: float = 0.4,
        cooldown_seconds: float | None = None,
    ) -> None:
        self._window = window_seconds or settings.INCIDENT_EVIDENCE_WINDOW_SECONDS
        self._min_evidence = min_evidence
        self._min_conf = min_mean_confidence
        self._cooldown = (
            cooldown_seconds
            if cooldown_seconds is not None
            else settings.INCIDENT_COOLDOWN_SECONDS
        )
        self._buffers: Dict[Tuple[str, str], EvidenceBuffer] = {}
        # key -> last verification timestamp (cooldown / duplicate suppression)
        self._last_verified: Dict[Tuple[str, str], float] = {}

    def mark_verified(self, key: Tuple[str, str], timestamp: float) -> None:
        """Record an actual emission for ``key`` (starts the cooldown).

        Must be called by the owner only when verified evidence was acted
        upon (e.g. an incident was confirmed). Mere verification without
        emission must NOT start a cooldown — otherwise early weak signals
        would silence the later strong evidence that should confirm.
        """
        self._last_verified[key] = timestamp

    def add(self, key: Tuple[str, str], item: EvidenceItem) -> VerificationResult:
        """Add evidence for ``key`` = (camera_id, candidate_id) and evaluate."""
        buf = self._buffers.get(key)
        if buf is None:
            buf = EvidenceBuffer(window_seconds=self._window)
            self._buffers[key] = buf
        buf.add(item)

        count = len(buf.items)
        mean_conf = buf.mean_confidence()
        span = buf.span_seconds()

        if count < self._min_evidence:
            return VerificationResult(
                verified=False,
                evidence_count=count,
                mean_confidence=mean_conf,
                span_seconds=span,
                reason="insufficient_temporal_evidence",
            )
        if mean_conf < self._min_conf:
            return VerificationResult(
                verified=False,
                evidence_count=count,
                mean_confidence=mean_conf,
                span_seconds=span,
                reason="low_evidence_confidence",
            )
        last = self._last_verified.get(key)
        if last is not None and (item.timestamp - last) < self._cooldown:
            return VerificationResult(
                verified=False,
                evidence_count=count,
                mean_confidence=mean_conf,
                span_seconds=span,
                reason="cooldown_duplicate_suppressed",
            )
        return VerificationResult(
            verified=True,
            evidence_count=count,
            mean_confidence=mean_conf,
            span_seconds=span,
            reason="temporal_evidence_sufficient",
        )

    def evidence_for(self, key: Tuple[str, str]) -> list[EvidenceItem]:
        buf = self._buffers.get(key)
        return buf.items if buf else []

    def reset(self, key: Tuple[str, str] | None = None) -> None:
        if key is None:
            self._buffers.clear()
            self._last_verified.clear()
        else:
            self._buffers.pop(key, None)
            self._last_verified.pop(key, None)
