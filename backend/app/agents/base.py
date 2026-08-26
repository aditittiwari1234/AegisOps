"""
agents/base.py — Shared base utilities for all AegisOps agents.
"""
from __future__ import annotations
import time
from pathlib import Path
from datetime import datetime
from typing import Any, Type, TypeVar
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models import AgentRun, IncidentEvent, Incident
from ..services.llm import llm
from ..websocket.manager import ws_manager

PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

T = TypeVar("T", bound=BaseModel)


def load_prompt(name: str, **kwargs: Any) -> str:
    """Load and format a prompt template from the prompts/ directory."""
    template = (PROMPTS_DIR / f"{name}.txt").read_text(encoding="utf-8")
    return template.format(**kwargs)


async def run_agent(
    *,
    db: AsyncSession,
    incident: Incident,
    agent_name: str,
    prompt: str,
    response_schema: Type[T],
) -> T:
    """
    Core agent runner:
    1. Persists agent_run record (running)
    2. Broadcasts starting live log
    3. Calls LLM with structured output
    4. Updates agent_run (done / failed)
    5. Emits WebSocket event + completion live log
    6. Returns validated Pydantic output
    """
    run = AgentRun(
        incident_id=incident.id,
        agent_name=agent_name,
        status="running",
        input_json={"prompt_length": len(prompt)},
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Broadcast "agent started"
    await ws_manager.broadcast(
        incident_id=incident.id,
        event_type="agent.started",
        agent=agent_name,
        status=incident.status,
        payload={"agent": agent_name},
    )

    await ws_manager.broadcast_log(
        incident_id=incident.id,
        level="INFO",
        source=f"AGENT:{agent_name}",
        message=f"Agent '{agent_name}' activated. Preparing prompt ({len(prompt)} chars)...",
        data={"prompt_preview": prompt[:300] + ("..." if len(prompt) > 300 else "")},
    )

    t0 = time.monotonic()
    try:
        await ws_manager.broadcast_log(
            incident_id=incident.id,
            level="DEBUG",
            source=f"AGENT:{agent_name}",
            message=f"Dispatching inference request to Gemini LLM with schema '{response_schema.__name__}'...",
        )

        result: T = await llm.complete_with_retry(prompt, response_schema)
        duration_ms = int((time.monotonic() - t0) * 1000)

        run.status = "done"
        run.output_json = result.model_dump()
        run.duration_ms = duration_ms
        await db.commit()

        # Broadcast "agent completed"
        await ws_manager.broadcast(
            incident_id=incident.id,
            event_type="agent.completed",
            agent=agent_name,
            status=incident.status,
            payload=result.model_dump(),
        )

        summary_msg = f"Agent '{agent_name}' completed analysis in {duration_ms}ms."
        await ws_manager.broadcast_log(
            incident_id=incident.id,
            level="SUCCESS",
            source=f"AGENT:{agent_name}",
            message=summary_msg,
            data=result.model_dump(),
        )
        return result

    except Exception as exc:
        duration_ms = int((time.monotonic() - t0) * 1000)
        run.status = "failed"
        run.output_json = {"error": str(exc)}
        run.duration_ms = duration_ms
        await db.commit()

        await ws_manager.broadcast(
            incident_id=incident.id,
            event_type="agent.failed",
            agent=agent_name,
            status=incident.status,
            payload={"error": str(exc)},
        )

        await ws_manager.broadcast_log(
            incident_id=incident.id,
            level="ERROR",
            source=f"AGENT:{agent_name}",
            message=f"Agent '{agent_name}' failed after {duration_ms}ms: {exc}",
            data={"error": str(exc)},
        )
        raise


async def add_event(db: AsyncSession, incident_id: str, event_type: str, message: str):
    """Append a timeline event to an incident."""
    ev = IncidentEvent(incident_id=incident_id, event_type=event_type, message=message)
    db.add(ev)
    await db.commit()
    await ws_manager.broadcast_log(
        incident_id=incident_id,
        level="INFO",
        source="SYSTEM",
        message=f"Timeline event [{event_type}]: {message}",
    )


async def update_status(db: AsyncSession, incident: Incident, new_status: str):
    """Change incident status and emit WebSocket + timeline event."""
    old = incident.status
    incident.status = new_status
    if new_status == "RESOLVED":
        incident.resolved_at = datetime.utcnow()
    await db.commit()
    await add_event(db, incident.id, "status_change", f"{old} → {new_status}")
    await ws_manager.broadcast(
        incident_id=incident.id,
        event_type="status.changed",
        agent=None,
        status=new_status,
        payload={"old": old, "new": new_status},
    )
    await ws_manager.broadcast_log(
        incident_id=incident.id,
        level="WARN" if new_status in ("DETECTED", "FAILED", "ESCALATED") else "SUCCESS" if new_status == "RESOLVED" else "INFO",
        source="ORCHESTRATOR",
        message=f"Incident status changed: {old} → {new_status}",
        data={"old_status": old, "new_status": new_status, "incident_id": incident.id},
    )
