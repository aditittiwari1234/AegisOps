"""
agents/safety.py — Safety Agent.
Evaluates whether the proposed runbook is safe to auto-execute.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Incident
from ..runbooks.registry import get_runbook
from .base import run_agent, load_prompt
from .root_cause import RootCauseOutput


class SafetyOutput(BaseModel):
    risk_level: str = Field(description="LOW | MEDIUM | HIGH")
    approved: bool = Field(description="True if safe to auto-execute, False if human approval required")
    blast_radius: str = Field(description="Description of potential impact scope")
    reversible: bool = Field(description="Whether the action can be undone")
    reasoning: str = Field(description="Clear explanation of the safety decision")


async def run(
    db: AsyncSession,
    incident: Incident,
    root_cause_result: RootCauseOutput,
) -> SafetyOutput:
    runbook_name = root_cause_result.recommended_runbook
    runbook = get_runbook(runbook_name) or {
        "description": "Unknown runbook — not in allowlist",
        "risk": "HIGH",
        "auto_approve": False,
    }

    prompt = load_prompt(
        "safety",
        service=incident.service,
        severity=incident.severity,
        root_cause=root_cause_result.root_cause,
        runbook_name=runbook_name,
        runbook_description=runbook.get("description", ""),
        risk_level=runbook.get("risk", "HIGH"),
    )
    return await run_agent(
        db=db,
        incident=incident,
        agent_name="safety",
        prompt=prompt,
        response_schema=SafetyOutput,
    )
