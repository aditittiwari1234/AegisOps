"""
schemas.py — Pydantic v2 request/response schemas for AegisOps REST API.
"""
from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


# ── Incident ──────────────────────────────────────────────────────────────────

class IncidentBase(BaseModel):
    service: str = "kartify"
    severity: str = "UNKNOWN"
    title: str = ""
    summary: str | None = None


class IncidentCreate(IncidentBase):
    pass


class IncidentEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_id: str
    event_type: str
    message: str
    ts: datetime


class AgentRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_id: str
    agent_name: str
    status: str
    input_json: dict[str, Any] | None
    output_json: dict[str, Any] | None
    duration_ms: int | None
    ts: datetime


class RemediationActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_id: str
    runbook_name: str
    status: str
    executed_at: datetime | None
    response_json: dict[str, Any] | None


class VerificationResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_id: str
    recovered: bool
    health_status: str | None
    error_rate_before: float | None
    error_rate_after: float | None
    details: dict[str, Any] | None
    ts: datetime


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    service: str
    severity: str
    status: str
    title: str
    summary: str | None
    root_cause: str | None
    created_at: datetime
    resolved_at: datetime | None
    events: list[IncidentEventOut] = []
    agent_runs: list[AgentRunOut] = []
    remediation_actions: list[RemediationActionOut] = []
    verification_results: list[VerificationResultOut] = []


# ── WebSocket event ───────────────────────────────────────────────────────────

class WSEvent(BaseModel):
    type: str                          # agent.started | agent.completed | status.changed
    incident_id: str
    agent: str | None = None
    status: str | None = None
    payload: dict[str, Any] = {}
    timestamp: datetime


# ── Simulate request ─────────────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    service: str = "kartify"
    trigger_kartify: bool = True       # call Kartify /admin/simulate-incident


# ── Knowledge ─────────────────────────────────────────────────────────────────

class KnowledgeIncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    service: str
    severity: str
    root_cause: str
    runbook_used: str
    resolution_summary: str
    tags: str | None
    ts: datetime
