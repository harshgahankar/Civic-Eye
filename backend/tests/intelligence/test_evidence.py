"""Evidence buffer, conversion, and explanation generation."""
from __future__ import annotations

from app.intelligence.evidence import (
    EvidenceBuffer,
    behavior_event_to_evidence,
    build_explanation,
)
from tests.intelligence.helpers import bev, ev_item


class TestEvidenceBuffer:
    def test_window_pruning(self) -> None:
        buf = EvidenceBuffer(window_seconds=2.0)
        buf.add(ev_item("POSSIBLE_COLLISION", 0.0, 0.9))
        buf.add(ev_item("POSSIBLE_COLLISION", 0.5, 0.9))
        buf.add(ev_item("POSSIBLE_COLLISION", 5.0, 0.9))
        assert buf.count() == 1  # old items aged out

    def test_track_id_union(self) -> None:
        buf = EvidenceBuffer(window_seconds=10.0)
        buf.add(ev_item("POSSIBLE_COLLISION", 0.0, 0.9, [17, 19]))
        buf.add(ev_item("SUDDEN_STOP", 0.5, 0.8, [17]))
        assert buf.track_ids() == [17, 19]

    def test_span_and_mean(self) -> None:
        buf = EvidenceBuffer(window_seconds=10.0)
        buf.add(ev_item("SUDDEN_STOP", 1.0, 0.6, [7]))
        buf.add(ev_item("SUDDEN_STOP", 3.0, 0.8, [7]))
        assert buf.span_seconds() == 3.0 - 1.0
        assert buf.mean_confidence() == 0.7


class TestConversion:
    def test_behavior_event_to_evidence(self) -> None:
        event = bev("POSSIBLE_COLLISION", 21.42, [12, 19],
                    ["car", "car"], 0.91)
        item = behavior_event_to_evidence(event)
        assert item.type == "POSSIBLE_COLLISION"
        assert item.timestamp == 21.42
        assert item.confidence == 0.91
        assert item.track_ids == [12, 19]
        assert item.source == "behavior_engine"
        assert item.metadata["event_id"] == event.event_id


class TestExplanation:
    def test_explanation_from_evidence(self) -> None:
        evidence = [
            ev_item("POSSIBLE_COLLISION", 21.42, 0.91, [17, 19]),
            ev_item("SUDDEN_STOP", 21.67, 0.88, [17]),
            ev_item("STATIONARY_OBJECT", 23.0, 0.8, [17]),
        ]
        reasons = build_explanation(evidence)
        assert len(reasons) >= 3
        assert any("multiple behavioral signals" in r for r in reasons)

    def test_empty_evidence_empty_reasons(self) -> None:
        assert build_explanation([]) == []
