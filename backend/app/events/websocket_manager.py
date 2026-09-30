"""
app/events/websocket_manager.py

WebSocket connection registry + broadcast fan-out.

Thread-safe by design: the video pipeline publishes from worker threads, so
each client owns a bounded ``asyncio.Queue`` filled via
``loop.call_soon_threadsafe``. A per-connection sender task drains the queue
to the socket. Slow clients drop oldest messages (bounded queue) instead of
blocking the pipeline; broken sockets are removed without affecting others.
"""
from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass, field
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.events.event_bus import EventEnvelope
from app.events.subscriber import envelope_matches

logger = get_logger(__name__)

_CLIENT_QUEUE_SIZE = 100


@dataclass
class _Client:
    id: int
    queue: "asyncio.Queue[dict[str, Any]]"
    loop: asyncio.AbstractEventLoop
    filters: dict[str, Any] = field(default_factory=dict)


class WebSocketManager:
    def __init__(self) -> None:
        self._clients: dict[int, _Client] = {}
        self._next_id = 0
        self._lock = asyncio.Lock()  # guards _clients within the event loop
        self._thread_lock = threading.Lock()

    # ── Connection lifecycle (called from the event loop) ─────────────────

    async def connect(
        self, queue: "asyncio.Queue[dict[str, Any]]",
        loop: asyncio.AbstractEventLoop | None = None,
    ) -> int:
        """Register a client queue. Returns the client id (-1 if full)."""
        async with self._lock:
            if len(self._clients) >= settings.MAX_WEBSOCKET_CLIENTS:
                return -1
            self._next_id += 1
            client_id = self._next_id
            self._clients[client_id] = _Client(
                id=client_id, queue=queue,
                loop=loop or asyncio.get_running_loop())
            logger.info({"event": "websocket_connect",
                         "client_id": client_id,
                         "connections": len(self._clients)})
            return client_id

    async def disconnect(self, client_id: int) -> None:
        async with self._lock:
            self._clients.pop(client_id, None)
            logger.info({"event": "websocket_disconnect",
                         "client_id": client_id,
                         "connections": len(self._clients)})

    def subscribe(self, client_id: int, filters: dict[str, Any]) -> bool:
        """Replace the subscription filters for a client (thread-safe)."""
        with self._thread_lock:
            client = self._clients.get(client_id)
            if client is None:
                return False
            client.filters = {
                "camera_ids": list(filters.get("camera_ids", [])),
                "incident_types": list(filters.get("incident_types", [])),
                "severities": list(filters.get("severities", [])),
                "event_types": list(filters.get("event_types", [])),
            }
            return True

    def unsubscribe(self, client_id: int) -> bool:
        return self.subscribe(client_id, {})

    def get_connection_count(self) -> int:
        with self._thread_lock:
            return len(self._clients)

    # ── Broadcast (safe from ANY thread) ──────────────────────────────────

    def broadcast_sync(self, envelope: EventEnvelope) -> int:
        """Fan out to matching clients. Never raises, never blocks."""
        try:
            message = envelope.model_dump(mode="json")
        except Exception:
            logger.exception("WebSocket broadcast serialization failed")
            return 0
        with self._thread_lock:
            clients = list(self._clients.values())
        delivered = 0
        for client in clients:
            try:
                if not envelope_matches(envelope, **client.filters):
                    continue
                client.loop.call_soon_threadsafe(
                    self._enqueue, client, message)
                delivered += 1
            except RuntimeError:
                # Loop closed — sender task cleanup will disconnect the client.
                continue
            except Exception:
                logger.exception("WebSocket broadcast scheduling failed")
        return delivered

    @staticmethod
    def _enqueue(client: _Client, message: dict[str, Any]) -> None:
        try:
            if client.queue.full():
                try:
                    client.queue.get_nowait()  # drop oldest, keep it real-time
                except asyncio.QueueEmpty:
                    pass
            client.queue.put_nowait(message)
        except Exception:
            pass

    def as_bus_subscriber(self):
        """Return a sync EventBus callback wired to broadcast_sync."""
        def _forward(envelope: EventEnvelope) -> None:
            self.broadcast_sync(envelope)
        return _forward


def make_client_queue() -> "asyncio.Queue[dict[str, Any]]":
    return asyncio.Queue(maxsize=_CLIENT_QUEUE_SIZE)
