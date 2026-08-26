"""
websocket/manager.py — WebSocket connection manager.
Tracks all connected clients and broadcasts incident events to them.
"""
from __future__ import annotations
import json
from datetime import datetime
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Maps incident_id → set of WebSocket connections subscribed to it.
        # Special key "*" means subscribe to all incidents.
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, incident_id: str = "*"):
        await websocket.accept()
        self._connections.setdefault(incident_id, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, incident_id: str = "*"):
        bucket = self._connections.get(incident_id, set())
        bucket.discard(websocket)

    async def broadcast(self, incident_id: str, event_type: str, agent: str | None, status: str | None, payload: dict):
        """Send an event to all clients subscribed to incident_id or to '*'."""
        message = json.dumps({
            "type": event_type,
            "incident_id": incident_id,
            "agent": agent,
            "status": status,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        })
        targets = (
            self._connections.get(incident_id, set()) |
            self._connections.get("*", set())
        )
        dead: list[tuple[WebSocket, str]] = []
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append((ws, incident_id))
        for ws, iid in dead:
            self.disconnect(ws, iid)


# Singleton used across the app
ws_manager = ConnectionManager()
