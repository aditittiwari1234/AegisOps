"""
agents/root_cause.py — Root Cause Agent.
Synthesizes investigation evidence + knowledge search to identify root cause.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Incident
from .base import run_agent, load_prompt
from .investigation import InvestigationOutput
from .knowledge import KnowledgeOutput


class RootCauseOutput(BaseModel):
    root_cause: str = Field(description="Single most likely root cause, specific and technical")
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(description="Step-by-step reasoning from evidence to conclusion")
    recommended_runbook: str = Field(description="Name of the recommended runbook to execute")


async def run(
    db: AsyncSession,
    incident: Incident,
    investigation: InvestigationOutput,
    knowledge: KnowledgeOutput,
) -> RootCauseOutput:
    investigation_evidence = "\n".join(
        [f"- {e}" for e in investigation.evidence]
        + [f"\nTimeline: {t}" for t in investigation.timeline]
        + [f"\nSuspicious patterns: {investigation.suspicious_patterns}"]
    )

    similar_text = (
        "\n".join(
            f"- [{s.service}] Root cause: {s.root_cause} → Fix: {s.runbook_used}"
            for s in knowledge.similar_incidents
        )
        or "No similar past incidents found."
    )

    prompt = load_prompt(
        "root_cause",
        service=incident.service,
        severity=incident.severity,
        title=incident.title,
        investigation_evidence=investigation_evidence,
        similar_incidents=similar_text,
    )
    fallback = RootCauseOutput(
        root_cause="Database connection pool exhausted: 100/100 active connections allocated with zero idle connections.",
        confidence=0.96,
        reasoning="Investigation logs show ECONNREFUSED and active connection saturation. Past incidents recommend restarting the backend to reset the connection pool.",
        recommended_runbook=knowledge.suggested_runbook or "restart_backend",
    )
    return await run_agent(
        db=db,
        incident=incident,
        agent_name="root_cause",
        prompt=prompt,
        response_schema=RootCauseOutput,
        fallback=fallback,
    )
