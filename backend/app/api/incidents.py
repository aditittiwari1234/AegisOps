"""
api/incidents.py — Incident REST endpoints.
"""
from __future__ import annotations
import asyncio
import os
import uuid
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Incident, IncidentEvent, KnowledgeIncident
from ..schemas import IncidentOut, SimulateRequest, KnowledgeIncidentOut
from ..orchestrator.engine import run_orchestrator

KARTIFY_URL = os.getenv("KARTIFY_URL", "http://localhost:4000")
KARTIFY_ADMIN_KEY = os.getenv("KARTIFY_ADMIN_KEY", "admin123")

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _with_relations():
    return selectinload(Incident.events).selectinload(Incident.agent_runs).selectinload(Incident.remediation_actions).selectinload(Incident.verification_results)


@router.get("", response_model=list[IncidentOut])
async def list_incidents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Incident)
        .options(
            selectinload(Incident.events),
            selectinload(Incident.agent_runs),
            selectinload(Incident.remediation_actions),
            selectinload(Incident.verification_results),
        )
        .order_by(Incident.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Incident)
        .where(Incident.id == incident_id)
        .options(
            selectinload(Incident.events),
            selectinload(Incident.agent_runs),
            selectinload(Incident.remediation_actions),
            selectinload(Incident.verification_results),
        )
    )
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc


@router.post("/simulate", response_model=IncidentOut)
async def simulate_incident(
    body: SimulateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a simulated incident:
    1. Call Kartify /admin/simulate-incident (optional)
    2. Create incident record in DETECTED state
    3. Fire orchestrator in background
    """
    # Step 1: tell Kartify to enter failure mode
    log_snippet = ""
    if body.trigger_kartify:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.post(
                    f"{KARTIFY_URL}/admin/simulate-incident",
                    headers={"x-admin-key": KARTIFY_ADMIN_KEY},
                )
            if r.status_code not in (200, 409):
                raise HTTPException(status_code=502, detail=f"Kartify simulation failed: {r.text}")
            log_snippet = (
                "[KARTIFY][INCIDENT] Failure mode activated — DB pool exhausted\n"
                "[KARTIFY][ERROR] ECONNREFUSED on db.read() — retrying\n"
                "[KARTIFY][ERROR] Active connections: 100/100"
            )
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Cannot reach Kartify at " + KARTIFY_URL)

    # Step 2: create incident record
    inc = Incident(
        id=str(uuid.uuid4()),
        service=body.service,
        severity="UNKNOWN",
        status="DETECTED",
        title=f"Health check failure detected on {body.service}",
        summary="Rule-based detector triggered: health endpoint returned unhealthy status.",
        created_at=datetime.utcnow(),
    )
    db.add(inc)
    ev = IncidentEvent(
        incident_id=inc.id,
        event_type="incident_created",
        message="Incident created by AegisOps rule-based detector (health check failure).",
    )
    db.add(ev)
    await db.commit()
    await db.refresh(inc)

    # Step 3: run orchestrator async
    background_tasks.add_task(run_orchestrator, inc.id, log_snippet)

    # Return a fresh copy with relations
    result = await db.execute(
        select(Incident)
        .where(Incident.id == inc.id)
        .options(
            selectinload(Incident.events),
            selectinload(Incident.agent_runs),
            selectinload(Incident.remediation_actions),
            selectinload(Incident.verification_results),
        )
    )
    return result.scalar_one()


@router.get("/knowledge/history", response_model=list[KnowledgeIncidentOut])
async def knowledge_history(db: AsyncSession = Depends(get_db)):
    """Return all resolved incidents stored in knowledge base."""
    result = await db.execute(
        select(KnowledgeIncident).order_by(KnowledgeIncident.ts.desc()).limit(20)
    )
    return result.scalars().all()
