"""
orchestrator/engine.py — AegisOps incident state machine.
Drives an incident through: DETECTED → INVESTIGATING → DIAGNOSING →
SAFETY_REVIEW → REMEDIATING → VERIFYING → RESOLVED (or FAILED).

Runs as an asyncio background task per incident.
"""
from __future__ import annotations
import asyncio
import os
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import AsyncSessionLocal
from ..models import Incident, KnowledgeIncident
from ..agents.base import add_event, update_status
from ..agents import detection, investigation, knowledge, root_cause, safety, action, verification
from ..websocket.manager import ws_manager

KARTIFY_URL = os.getenv("KARTIFY_URL", "http://localhost:4000")


async def run_orchestrator(incident_id: str, log_snippet: str = ""):
    """
    Entry point: run the full agent pipeline for an incident.
    Called via: asyncio.create_task(run_orchestrator(incident_id))
    """
    async with AsyncSessionLocal() as db:
        try:
            await _run(db, incident_id, log_snippet)
        except Exception as exc:
            # Mark incident as FAILED on unhandled orchestrator error
            async with AsyncSessionLocal() as err_db:
                result = await err_db.execute(select(Incident).where(Incident.id == incident_id))
                inc = result.scalar_one_or_none()
                if inc:
                    await update_status(err_db, inc, "FAILED")
                    await add_event(err_db, incident_id, "orchestrator_error", str(exc))
            raise


async def _run(db: AsyncSession, incident_id: str, log_snippet: str):
    # ── Load incident ──────────────────────────────────────────────────────────
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc: Incident | None = result.scalar_one_or_none()
    if not inc:
        return

    await ws_manager.broadcast(
        incident_id=incident_id,
        event_type="orchestrator.started",
        agent=None,
        status="DETECTED",
        payload={"incident_id": incident_id},
    )

    # ── DETECTED → INVESTIGATING ───────────────────────────────────────────────
    await update_status(db, inc, "INVESTIGATING")
    await add_event(db, incident_id, "agent_started", "Detection Agent: enriching severity and summary")

    detection_result = await detection.run(
        db=db,
        incident=inc,
        health_status="unhealthy",
        http_status_code=503,
        error_message="Database connection pool exhausted",
    )
    inc.severity = detection_result.severity
    inc.title = detection_result.title
    inc.summary = detection_result.summary
    await db.commit()

    # ── INVESTIGATING → DIAGNOSING ─────────────────────────────────────────────
    await update_status(db, inc, "DIAGNOSING")
    await add_event(db, incident_id, "agent_started", "Investigation Agent: collecting evidence")

    investigation_result = await investigation.run(
        db=db,
        incident=inc,
        log_snippet=log_snippet,
    )

    await add_event(db, incident_id, "agent_started", "Knowledge Agent: searching past incidents")

    keywords = ["connection pool", "database", "db", "exhausted", inc.service]
    knowledge_result = await knowledge.run(
        db=db,
        incident=inc,
        keywords=keywords,
    )

    await add_event(db, incident_id, "agent_started", "Root Cause Agent: synthesizing diagnosis")

    root_cause_result = await root_cause.run(
        db=db,
        incident=inc,
        investigation=investigation_result,
        knowledge=knowledge_result,
    )
    inc.root_cause = root_cause_result.root_cause
    await db.commit()

    # ── DIAGNOSING → SAFETY_REVIEW ─────────────────────────────────────────────
    await update_status(db, inc, "SAFETY_REVIEW")
    await add_event(db, incident_id, "agent_started", f"Safety Agent: evaluating '{root_cause_result.recommended_runbook}'")

    safety_result = await safety.run(
        db=db,
        incident=inc,
        root_cause_result=root_cause_result,
    )

    runbook_name = root_cause_result.recommended_runbook

    # Safety gate: block if not approved and not auto-approved
    if not safety_result.approved and safety_result.risk_level in ("MEDIUM", "HIGH"):
        await update_status(db, inc, "AWAITING_APPROVAL")
        await add_event(
            db, incident_id, "approval_required",
            f"Action '{runbook_name}' requires human approval (risk={safety_result.risk_level})"
        )
        # For hackathon MVP: auto-approve MEDIUM after 3s delay (simulate human click)
        if safety_result.risk_level == "MEDIUM":
            await asyncio.sleep(3)
        else:
            await add_event(db, incident_id, "escalated", "HIGH risk action blocked — escalated to on-call")
            await update_status(db, inc, "ESCALATED")
            return

    # ── SAFETY_REVIEW → REMEDIATING ───────────────────────────────────────────
    await update_status(db, inc, "REMEDIATING")
    await add_event(db, incident_id, "runbook_executing", f"Executing runbook: {runbook_name}")

    action_result = await action.run(
        db=db,
        incident=inc,
        runbook_name=runbook_name,
    )

    if not action_result.executed:
        await update_status(db, inc, "FAILED")
        await add_event(db, incident_id, "action_failed", action_result.error or "Action execution failed")
        return

    await add_event(db, incident_id, "runbook_complete", f"Runbook '{runbook_name}' executed successfully")

    # ── REMEDIATING → VERIFYING ────────────────────────────────────────────────
    await update_status(db, inc, "VERIFYING")
    await add_event(db, incident_id, "agent_started", "Verification Agent: confirming recovery")

    # Small buffer to allow Kartify to recover
    await asyncio.sleep(2)

    verification_result = await verification.run(
        db=db,
        incident=inc,
        runbook_used=runbook_name,
    )

    if verification_result.recovered:
        # ── VERIFYING → RESOLVED ───────────────────────────────────────────────
        inc.root_cause = inc.root_cause or root_cause_result.root_cause
        await update_status(db, inc, "RESOLVED")
        await add_event(db, incident_id, "resolved", verification_result.resolution_summary)

        # Store in knowledge base for future incidents
        await _store_knowledge(
            db=db,
            incident=inc,
            runbook_used=runbook_name,
            resolution_summary=verification_result.resolution_summary,
        )
    else:
        await update_status(db, inc, "FAILED")
        await add_event(
            db, incident_id, "verification_failed",
            f"Verification failed: health={verification_result.health_status}"
        )


async def _store_knowledge(
    db: AsyncSession,
    incident: Incident,
    runbook_used: str,
    resolution_summary: str,
):
    """Write resolved incident to knowledge_incidents for future Knowledge Agent queries."""
    ki = KnowledgeIncident(
        service=incident.service,
        severity=incident.severity,
        root_cause=incident.root_cause or "",
        runbook_used=runbook_used,
        resolution_summary=resolution_summary,
        tags="connection pool,database,kartify,restart_backend",
    )
    db.add(ki)
    await db.commit()
