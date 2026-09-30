"""Subscription filter matching (shared by WebSocket layer)."""
from __future__ import annotations

from app.events import event_types
from app.events.event_bus import EventEnvelope
from app.events.subscriber import FilteredSubscriber, envelope_matches


def _env(**kw) -> EventEnvelope:
    base = {"event_type": event_types.INCIDENT_CREATED,
            "source": "t",
            "camera_id": "CAM-01",
            "payload": {"incident_type": "ACCIDENT", "severity": "HIGH"}}
    base.update(kw)
    return EventEnvelope(**base)


class TestEnvelopeMatches:
    def test_empty_filters_match_all(self) -> None:
        assert envelope_matches(_env()) is True

    def test_camera_filter(self) -> None:
        assert envelope_matches(_env(), camera_ids=["CAM-01"]) is True
        assert envelope_matches(_env(), camera_ids=["CAM-03"]) is False

    def test_incident_type_filter(self) -> None:
        assert envelope_matches(
            _env(), incident_types=["ACCIDENT"]) is True
        assert envelope_matches(
            _env(), incident_types=["CROWD_ANOMALY"]) is False

    def test_severity_filter(self) -> None:
        assert envelope_matches(_env(), severities=["HIGH"]) is True
        assert envelope_matches(_env(), severities=["LOW"]) is False

    def test_event_type_filter(self) -> None:
        assert envelope_matches(
            _env(), event_types=[event_types.INCIDENT_CREATED]) is True
        assert envelope_matches(
            _env(), event_types=[event_types.CAMERA_OFFLINE]) is False

    def test_non_incident_event_passes_incident_filters(self) -> None:
        env = _env(event_type=event_types.CAMERA_OFFLINE, payload={})
        assert envelope_matches(env, incident_types=["ACCIDENT"]) is True

    def test_filtered_subscriber_forwards_only_matches(self) -> None:
        bus_events: list = []
        from app.events.event_bus import EventBus
        bus = EventBus()
        FilteredSubscriber(bus_events.append,
                           camera_ids=["CAM-01"]).attach(bus)
        bus.publish(event_types.INCIDENT_CREATED, {}, camera_id="CAM-01")
        bus.publish(event_types.INCIDENT_CREATED, {}, camera_id="CAM-02")
        assert len(bus_events) == 1
        assert bus_events[0].camera_id == "CAM-01"
