"""
agents/knowledge.py — Knowledge Agent.
Searches past resolved incidents in knowledge_incidents table for similar patterns.
No embeddings for hackathon — uses SQLite LIKE full-text search.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Incident, KnowledgeIncident
from ..websocket.manager import ws_manager


class SimilarIncident(BaseModel):
    service: str
    root_cause: str
    runbook_used: str
    resolution_summary: str
    ts: str


class KnowledgeOutput(BaseModel):
    similar_incidents: list[SimilarIncident] = Field(default_factory=list)
    suggested_runbook: str | None = Field(default=None)
    knowledge_summary: str = Field(description="Brief summary of what past incidents suggest")


async def run(
    db: AsyncSession,
    incident: Incident,
    keywords: list[str],
) -> KnowledgeOutput:
    """
    Search knowledge_incidents for rows where root_cause or tags contain any keyword.
    This agent does NOT call the LLM — pure SQL lookup.
    """
    await ws_manager.broadcast(
        incident_id=incident.id,
        event_type="agent.started",
        agent="knowledge",
        status=incident.status,
        payload={"keywords": keywords},
    )

    await ws_manager.broadcast_log(
        incident_id=incident.id,
        level="INFO",
        source="AGENT:knowledge",
        message=f"Knowledge Agent querying historical database with keywords: {', '.join(keywords)}",
        data={"keywords": keywords},
    )

    # Build LIKE filter for each keyword
    filters = []
    for kw in keywords:
        pattern = f"%{kw}%"
        filters.append(KnowledgeIncident.root_cause.ilike(pattern))
        filters.append(KnowledgeIncident.tags.ilike(pattern))

    stmt = select(KnowledgeIncident).where(or_(*filters)).order_by(
        KnowledgeIncident.ts.desc()
    ).limit(5)

    rows = (await db.execute(stmt)).scalars().all()

    similar = [
        SimilarIncident(
            service=r.service,
            root_cause=r.root_cause,
            runbook_used=r.runbook_used,
            resolution_summary=r.resolution_summary,
            ts=r.ts.isoformat(),
        )
        for r in rows
    ]

    # Suggest runbook based on most common past resolution
    suggested = None
    if rows:
        runbook_counts: dict[str, int] = {}
        for r in rows:
            runbook_counts[r.runbook_used] = runbook_counts.get(r.runbook_used, 0) + 1
        suggested = max(runbook_counts, key=runbook_counts.get)

    knowledge_summary = (
        f"Found {len(similar)} similar past incidents."
        + (f" Most common fix: '{suggested}'." if suggested else " No prior resolutions found — first time seeing this pattern.")
    )

    result = KnowledgeOutput(
        similar_incidents=similar,
        suggested_runbook=suggested,
        knowledge_summary=knowledge_summary,
    )

    await ws_manager.broadcast(
        incident_id=incident.id,
        event_type="agent.completed",
        agent="knowledge",
        status=incident.status,
        payload=result.model_dump(),
    )

    await ws_manager.broadcast_log(
        incident_id=incident.id,
        level="SUCCESS",
        source="AGENT:knowledge",
        message=f"Knowledge Agent match complete: {knowledge_summary}",
        data=result.model_dump(),
    )

    return result
