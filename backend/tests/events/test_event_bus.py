"""EventBus: publish/subscribe, isolation, bounded history, envelope."""
from __future__ import annotations

import pytest

from app.events import event_types
from app.events.event_bus import EventBus, EventEnvelope


class TestEventBus:
    def test_publish_delivers_to_subscriber(self) -> None:
        bus = EventBus()
        received: list = []
        bus.subscribe(received.append)
        env = bus.publish(event_types.INCIDENT_CREATED,
                          {"incident_type": "ACCIDENT"},
                          source="incident_engine", camera_id="CAM-01",
                          incident_id="INC-1")
        assert len(received) == 1
        assert received[0].event_id == env.event_id
        assert received[0].priority == "MEDIUM"

    def test_multiple_subscribers_all_receive(self) -> None:
        bus = EventBus()
        a: list = []
        b: list = []
        bus.subscribe(a.append)
        bus.subscribe(b.append)
        bus.publish(event_types.SYSTEM_STATUS_CHANGED, {})
        assert len(a) == 1 and len(b) == 1

    def test_failed_subscriber_does_not_crash_bus(self) -> None:
        bus = EventBus()
        good: list = []

        def bad(envelope) -> None:
            raise RuntimeError("subscriber boom")

        bus.subscribe(bad)
        bus.subscribe(good.append)
        bus.publish(event_types.INCIDENT_CONFIRMED, {})
        assert len(good) == 1  # bus + healthy subscriber survived

    def test_history_bounded(self) -> None:
        bus = EventBus(max_history=10)
        for _ in range(25):
            bus.publish(event_types.HEARTBEAT, {})
        assert bus.history_size == 10
        assert bus.published_count == 25

    def test_unknown_event_type_rejected(self) -> None:
        bus = EventBus()
        with pytest.raises(ValueError):
            bus.publish("NOT_A_REAL_EVENT", {})

    def test_envelope_validation(self) -> None:
        env = EventEnvelope(event_type=event_types.INCIDENT_CREATED,
                            source="t", payload={})
        assert env.event_id.startswith("EVT-")
        assert env.schema_version == "v1"
        assert env.timestamp > 0

    def test_unsubscribe(self) -> None:
        bus = EventBus()
        received: list = []
        cb = received.append
        bus.subscribe(cb)
        bus.unsubscribe(cb)
        bus.publish(event_types.HEARTBEAT, {})
        assert received == []

    def test_recent_filters(self) -> None:
        bus = EventBus()
        bus.publish(event_types.INCIDENT_CREATED, {}, camera_id="CAM-01")
        bus.publish(event_types.INCIDENT_CREATED, {}, camera_id="CAM-02")
        assert len(bus.recent(camera_id="CAM-01")) == 1
        assert len(bus.recent(
            event_type=event_types.INCIDENT_CREATED)) == 2

    def test_priorities(self) -> None:
        assert event_types.priority_of(
            event_types.INCIDENT_CONFIRMED) == "HIGH"
        assert event_types.priority_of(
            event_types.CAMERA_OFFLINE) == "HIGH"
        assert event_types.priority_of(
            event_types.BEHAVIOR_EVENT_CREATED) == "MEDIUM"
