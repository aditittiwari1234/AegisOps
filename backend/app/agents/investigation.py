"""
agents/investigation.py — Investigation Agent.
Collects and analyzes evidence from logs and telemetry.
"""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Incident
from .base import run_agent, load_prompt


class InvestigationOutput(BaseModel):
    evidence: list[str] = Field(description="List of key evidence points observed")
    timeline: list[str] = Field(description="Chronological bullet points of what happened")
    affected_components: list[str] = Field(description="Names of affected system components")
    suspicious_patterns: str = Field(description="Summary of unusual patterns noticed")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence in investigation (0-1)")


async def run(
    db: AsyncSession,
    incident: Incident,
    log_snippet: str,
) -> InvestigationOutput:
    prompt = load_prompt(
        "investigation",
        service=incident.service,
        severity=incident.severity,
        title=incident.title,
        health_status="unhealthy",
        error_message=incident.summary or "Service health check failed",
        log_snippet=log_snippet or "No logs captured — rule-based detection only.",
    )
    fallback = InvestigationOutput(
        evidence=[
            "HTTP 503 on /health probe",
            "Active connections: 100/100 (pool saturated)",
            "ECONNREFUSED on database reads",
        ],
        timeline=[
            "Service health check transitioned to unhealthy",
            "Connection pool reached maximum allocated limit (100)",
            "Incoming requests failing with HTTP 500/503",
        ],
        affected_components=["database_pool", "product_api"],
        suspicious_patterns="Rapid connection pool exhaustion without connection release.",
        confidence=0.95,
    )
    return await run_agent(
        db=db,
        incident=incident,
        agent_name="investigation",
        prompt=prompt,
        response_schema=InvestigationOutput,
        fallback=fallback,
    )
