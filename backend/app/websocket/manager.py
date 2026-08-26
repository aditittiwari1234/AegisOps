"""
websocket/manager.py — WebSocket connection manager.
Tracks all connected clients and broadcasts incident events and live logs to them.
"""
from __future__ import annotations
import json
import uuid
from datetime import datetime
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Maps incident_id → set of WebSocket connections subscribed to it.
        # Special key "*" means subscribe to all incidents.
        self._connections: dict[str, set[WebSocket]] = {}
        # Global ring buffer of recent logs (max 1000)
        self._log_history: list[dict] = []
        # Per-incident ring buffers (max 500 per incident)
        self._incident_logs: dict[str, list[dict]] = {}

    def get_logs(self, incident_id: str | None = None, limit: int = 300) -> list[dict]:
        if incident_id and incident_id != "*":
            logs = self._incident_logs.get(incident_id, [])
            return logs[-limit:]
        return self._log_history[-limit:]

    async def connect(self, websocket: WebSocket, incident_id: str = "*"):
        await websocket.accept()
        self._connections.setdefault(incident_id, set()).add(websocket)
        try:
            await websocket.send_text(json.dumps({
                "type": "connection.established",
                "incident_id": incident_id,
                "agent": None,
                "status": "connected",
                "payload": {
                    "message": "WebSocket connected to AegisOps engine",
                    "initial_logs": self.get_logs(incident_id, limit=50),
                },
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }))
        except Exception:
            pass

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

    async def broadcast_log(
        self,
        incident_id: str | None,
        level: str,
        source: str,
        message: str,
        data: dict | None = None,
    ):
        """
        Broadcast a structured live log entry to WebSocket clients and record in ring buffer.
        level: INFO | WARN | ERROR | SUCCESS | DEBUG
        source: AGENT:detection | AGENT:investigation | AGENT:root_cause | AGENT:safety | AGENT:action | AGENT:verification | AGENT:knowledge | KARTIFY | ORCHESTRATOR | HEALTH_POLLER | SYSTEM
        """
        ts = datetime.utcnow().isoformat() + "Z"
        entry_id = f"log_{uuid.uuid4().hex[:8]}"
        log_entry = {
            "id": entry_id,
            "incident_id": incident_id or "*",
            "level": level.upper(),
            "source": source,
            "message": message,
            "data": data,
            "timestamp": ts,
        }

        self._log_history.append(log_entry)
        if len(self._log_history) > 1000:
            self._log_history.pop(0)

        if incident_id and incident_id != "*":
            self._incident_logs.setdefault(incident_id, []).append(log_entry)
            if len(self._incident_logs[incident_id]) > 500:
                self._incident_logs[incident_id].pop(0)

        # Broadcast via websocket
        await self.broadcast(
            incident_id=incident_id or "*",
            event_type="log.entry",
            agent=source.split(":")[1] if source.startswith("AGENT:") else None,
            status=None,
            payload=log_entry,
        )


# Singleton used across the app
ws_manager = ConnectionManager()
