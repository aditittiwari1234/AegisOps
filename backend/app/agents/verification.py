"""
agents/verification.py — Verification Agent.
Polls Kartify health post-remediation and confirms recovery with LLM summary.
"""
from __future__ import annotations
import asyncio
import httpx
import os
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Incident, VerificationResult
from .base import run_agent, load_prompt

KARTIFY_URL = os.getenv("KARTIFY_URL", "http://localhost:4000")


class VerificationOutput(BaseModel):
    recovered: bool
    health_status: str
    error_rate_after: float = Field(description="Estimated error rate after remediation as a percentage")
    confidence: float = Field(ge=0.0, le=1.0)
    resolution_summary: str = Field(description="Post-mortem resolution summary")


async def _poll_health(attempts: int = 3, delay: float = 4.0) -> dict:
    """Poll /health up to `attempts` times, return last result."""
    last: dict = {"status": "unknown", "http_status": 0}
    for _ in range(attempts):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{KARTIFY_URL}/health")
                body = r.json()
                last = {"status": body.get("status", "unknown"), "http_status": r.status_code}
                if body.get("status") == "ok":
                    return last
        except Exception as exc:
            last = {"status": "unreachable", "http_status": 0, "error": str(exc)}
        await asyncio.sleep(delay)
    return last


async def run(
    db: AsyncSession,
    incident: Incident,
    runbook_used: str,
) -> VerificationOutput:
    # Poll health 3× with 4s between checks
    health = await _poll_health(attempts=3, delay=4.0)

    recovered = health.get("status") == "ok"
    error_rate_before = 100.0   # 100% failure rate before remediation
    error_rate_after = 0.0 if recovered else 100.0

    prompt = load_prompt(
        "verification",
        service=incident.service,
        root_cause=incident.root_cause or "DB connection pool exhausted",
        runbook_used=runbook_used,
        health_status=health.get("status", "unknown"),
        http_status_code=health.get("http_status", 0),
        error_rate_before=error_rate_before,
        error_rate_after=error_rate_after,
        response_time_ms="<100" if recovered else "timeout",
        checks_summary=f"Health endpoint returned: {health}",
    )
    result = await run_agent(
        db=db,
        incident=incident,
        agent_name="verification",
        prompt=prompt,
        response_schema=VerificationOutput,
    )

    # Persist verification result
    vr = VerificationResult(
        incident_id=incident.id,
        recovered=result.recovered,
        health_status=result.health_status,
        error_rate_before=error_rate_before,
        error_rate_after=result.error_rate_after,
        details=health,
    )
    db.add(vr)
    await db.commit()

    return result
