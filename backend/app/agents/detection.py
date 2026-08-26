"""
agents/detection.py — Detection Agent.
Enriches a rule-triggered incident with AI-assessed severity and summary.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Incident
from .base import run_agent, load_prompt


class DetectionOutput(BaseModel):
    severity: str = Field(description="CRITICAL | HIGH | MEDIUM | LOW")
    service: str = Field(description="Name of the affected service")
    title: str = Field(description="One-sentence incident title, e.g. 'Kartify DB connection pool exhausted'")
    summary: str = Field(description="2-3 sentence explanation of the anomaly detected")


async def run(
    db: AsyncSession,
    incident: Incident,
    health_status: str,
    http_status_code: int,
    error_message: str,
) -> DetectionOutput:
    prompt = load_prompt(
        "detection",
        service=incident.service,
        health_status=health_status,
        http_status_code=http_status_code,
        error_message=error_message,
        timestamp=incident.created_at.isoformat(),
    )
    return await run_agent(
        db=db,
        incident=incident,
        agent_name="detection",
        prompt=prompt,
        response_schema=DetectionOutput,
    )
