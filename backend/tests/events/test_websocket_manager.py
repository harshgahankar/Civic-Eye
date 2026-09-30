"""WebSocket: connect, receive, filters, heartbeat, malformed input."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.events import event_types, get_default_bus
from app.main import app


@pytest.fixture()
def ws_client():
    bus = get_default_bus()
    bus.reset()
    with TestClient(app) as client:
        yield client
    bus.reset()


class TestWebSocket:
    def test_connect_and_hello(self, ws_client) -> None:
        with ws_client.websocket_connect("/api/v1/ws") as ws:
            hello = ws.receive_json()
            assert "client_id" in hello

    def test_receives_published_incident_event(self, ws_client) -> None:
        bus = get_default_bus()
        with ws_client.websocket_connect("/api/v1/ws") as ws:
            ws.receive_json()  # hello
            bus.publish(event_types.INCIDENT_CONFIRMED,
                        {"incident_type": "ACCIDENT", "severity": "HIGH",
                         "confidence": 0.9},
                        source="incident_engine", camera_id="CAM-01",
                        incident_id="INC-TEST")
            msg = ws.receive_json()
            assert msg["event_type"] == "INCIDENT_CONFIRMED"
            assert msg["incident_id"] == "INC-TEST"
            assert msg["payload"]["severity"] == "HIGH"

    def test_subscription_filters(self, ws_client) -> None:
        bus = get_default_bus()
        with ws_client.websocket_connect("/api/v1/ws") as ws:
            ws.receive_json()  # hello
            ws.send_json({"action": "subscribe",
                          "camera_ids": ["CAM-03"],
                          "incident_types": [], "severities": [],
                          "event_types": []})
            ack = ws.receive_json()
            assert ack["event_type"] == "SUBSCRIBED"
            bus.publish(event_types.INCIDENT_CREATED,
                        {"incident_type": "ACCIDENT"},
                        camera_id="CAM-01", incident_id="INC-A")
            bus.publish(event_types.INCIDENT_CREATED,
                        {"incident_type": "ACCIDENT"},
                        camera_id="CAM-03", incident_id="INC-B")
            msg = ws.receive_json()
            assert msg["incident_id"] == "INC-B"

    def test_subscribe_all_cameras(self, ws_client) -> None:
        bus = get_default_bus()
        with ws_client.websocket_connect("/api/v1/ws") as ws:
            ws.receive_json()
            ws.send_json({"action": "subscribe", "camera_ids": []})
            ws.receive_json()  # SUBSCRIBED ack
            bus.publish(event_types.INCIDENT_CREATED, {},
                        camera_id="CAM-09", incident_id="INC-Z")
            assert ws.receive_json()["incident_id"] == "INC-Z"

    def test_ping_pong(self, ws_client) -> None:
        with ws_client.websocket_connect("/api/v1/ws") as ws:
            ws.receive_json()
            ws.send_json({"action": "ping"})
            assert ws.receive_json()["event_type"] == "PONG"

    def test_malformed_and_unknown_actions(self, ws_client) -> None:
        with ws_client.websocket_connect("/api/v1/ws") as ws:
            ws.receive_json()
            ws.send_json({"action": "frobnicate"})
            err = ws.receive_json()
            assert err["event_type"] == "ERROR"
            assert "traceback" not in str(err).lower()
            ws.send_json({"action": "unsubscribe"})
            assert ws.receive_json()["event_type"] == "UNSUBSCRIBED"


class TestWebSocketManagerUnit:
    def test_connection_count(self) -> None:
        import asyncio
        from app.api.ws import get_ws_manager

        async def _run() -> None:
            manager = get_ws_manager()
            before = manager.get_connection_count()
            q: asyncio.Queue = asyncio.Queue()
            cid = await manager.connect(q)
            assert manager.get_connection_count() == before + 1
            await manager.disconnect(cid)
            assert manager.get_connection_count() == before

        asyncio.run(_run())
