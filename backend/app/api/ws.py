"""
app/api/ws.py

Real-time WebSocket endpoint: WS /api/v1/ws

- Server pushes EventBus envelopes (incidents, merges, camera health…).
- Client may send {"action": "subscribe", ...} filters; empty lists = all.
- Client may send {"action": "ping"} → receives {"event_type": "PONG"}.
- Malformed messages get an error frame; connections never leak.
"""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.logging import get_logger
from app.events import event_types, get_default_bus
from app.events.websocket_manager import WebSocketManager, make_client_queue

logger = get_logger(__name__)

router = APIRouter(tags=["realtime"])

_manager = WebSocketManager()
_manager_attached = False


def get_ws_manager() -> WebSocketManager:
    """Process-wide manager, attached to the default bus on first use."""
    global _manager_attached
    if not _manager_attached:
        _manager_attached = True
        get_default_bus().subscribe(_manager.as_bus_subscriber())
    return _manager


def _clean_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value
            if isinstance(v, str) and str(v).strip()][:64]


@router.websocket("/ws")
async def realtime_feed(websocket: WebSocket) -> None:
    manager = get_ws_manager()
    await websocket.accept()
    queue = make_client_queue()
    loop = asyncio.get_running_loop()
    client_id = await manager.connect(queue, loop)
    if client_id < 0:
        await websocket.close(code=1013, reason="server busy")
        return
    await websocket.send_json({"event_type": "HELLO",
                               "client_id": client_id,
                               "message": "subscribed to all events "
                                          "(send subscribe to filter)"})

    sender = asyncio.create_task(_sender_loop(websocket, queue, client_id))
    try:
        while True:
            try:
                message = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:
                await _safe_send(
                    websocket, {"event_type": "ERROR",
                                "message": "malformed message; "
                                           "expected JSON object"})
                continue
            await _handle_client_message(websocket, manager, client_id,
                                         message)
    finally:
        sender.cancel()
        try:
            await sender
        except asyncio.CancelledError:
            pass
        except Exception:
            pass
        await manager.disconnect(client_id)
        try:
            await websocket.close()
        except Exception:
            pass


async def _sender_loop(websocket: WebSocket, queue, client_id: int) -> None:
    """Drain the client queue to the socket; exits on broken connection."""
    try:
        while True:
            message = await queue.get()
            try:
                await websocket.send_json(message)
            except Exception:
                break  # broken client — outer finally disconnects
    except asyncio.CancelledError:
        raise


async def _safe_send(websocket: WebSocket, payload: dict) -> None:
    try:
        await websocket.send_json(payload)
    except Exception:
        pass


async def _handle_client_message(
    websocket: WebSocket, manager: WebSocketManager,
    client_id: int, message: Any,
) -> None:
    if not isinstance(message, dict):
        await _safe_send(websocket, {"event_type": "ERROR",
                                     "message": "message must be a JSON object"})
        return
    action = str(message.get("action", "")).lower()
    if action == "ping":
        await _safe_send(websocket, {"event_type": event_types.PONG})
    elif action == "subscribe":
        filters = {
            "camera_ids": _clean_str_list(message.get("camera_ids")),
            "incident_types": _clean_str_list(message.get("incident_types")),
            "severities": _clean_str_list(message.get("severities")),
            "event_types": _clean_str_list(message.get("event_types")),
        }
        manager.subscribe(client_id, filters)
        await _safe_send(websocket, {"event_type": "SUBSCRIBED",
                                     "filters": filters})
    elif action == "unsubscribe":
        manager.unsubscribe(client_id)
        await _safe_send(websocket, {"event_type": "UNSUBSCRIBED"})
    else:
        await _safe_send(websocket, {"event_type": "ERROR",
                                     "message": f"unknown action: "
                                                f"{message.get('action')!r}"})
