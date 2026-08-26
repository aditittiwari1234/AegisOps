"""
api/websocket.py — WebSocket endpoint for live incident event streaming.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..websocket.manager import ws_manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/incidents")
async def ws_incidents(websocket: WebSocket):
    """Subscribe to ALL incident events (wildcard subscription)."""
    await ws_manager.connect(websocket, incident_id="*")
    try:
        while True:
            # Keep connection alive; client sends pings, we just wait
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, incident_id="*")


@router.websocket("/ws/incidents/{incident_id}")
async def ws_incident(websocket: WebSocket, incident_id: str):
    """Subscribe to events for a specific incident."""
    await ws_manager.connect(websocket, incident_id=incident_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, incident_id=incident_id)
