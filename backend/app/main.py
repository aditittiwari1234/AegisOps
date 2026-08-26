"""
main.py — AegisOps FastAPI application entry point.
"""
from __future__ import annotations
import os
import asyncio
import httpx
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .database import init_db, AsyncSessionLocal
from .api.incidents import router as incidents_router
from .api.websocket import router as ws_router
from .models import KnowledgeIncident

load_dotenv()

KARTIFY_URL = os.getenv("KARTIFY_URL", "http://localhost:4000")


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init SQLite schema
    await init_db()
    # Seed knowledge base with past incidents if empty
    await seed_knowledge()
    # Start background health poller
    task = asyncio.create_task(health_poller())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AegisOps",
    description="AI-powered autonomous incident response platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents_router)
app.include_router(ws_router)


@app.get("/")
async def root():
    return {"service": "AegisOps", "status": "ok", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok", "ts": datetime.utcnow().isoformat()}


# ── Rule-based health poller ──────────────────────────────────────────────────

_last_health_status = "ok"


async def health_poller():
    """
    Polls Kartify /health every 5 seconds.
    If status changes to unhealthy, auto-creates an incident and fires the orchestrator.
    Idempotent: won't create duplicate incidents while service is unhealthy.
    """
    global _last_health_status
    from .models import Incident, IncidentEvent
    from sqlalchemy import select
    from .orchestrator.engine import run_orchestrator
    import uuid

    while True:
        await asyncio.sleep(5)
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                r = await client.get(f"{KARTIFY_URL}/health")
                body = r.json()
                current = body.get("status", "unknown")
        except Exception:
            current = "unreachable"

        if current != "ok" and _last_health_status == "ok":
            # Transition: healthy → unhealthy → auto-create incident
            async with AsyncSessionLocal() as db:
                # Check no active incident already
                active = await db.execute(
                    select(Incident).where(
                        Incident.service == "kartify",
                        Incident.status.not_in(["RESOLVED", "FAILED", "ESCALATED"]),
                    )
                )
                if active.scalar_one_or_none() is None:
                    inc = Incident(
                        id=str(uuid.uuid4()),
                        service="kartify",
                        severity="UNKNOWN",
                        status="DETECTED",
                        title="Kartify health check failure detected (auto)",
                        summary="Automated rule-based detector: health endpoint returned unhealthy status.",
                        created_at=datetime.utcnow(),
                    )
                    db.add(inc)
                    ev = IncidentEvent(
                        incident_id=inc.id,
                        event_type="incident_created",
                        message="Auto-created by health poller (rule-based detection).",
                    )
                    db.add(ev)
                    await db.commit()
                    asyncio.create_task(run_orchestrator(inc.id, "Auto-detected health failure"))

        _last_health_status = current if current == "ok" else "unhealthy"


# ── Knowledge base seed ───────────────────────────────────────────────────────

async def seed_knowledge():
    """Pre-populate knowledge_incidents with 3 realistic past incidents for demo."""
    async with AsyncSessionLocal() as db:
        from sqlalchemy import func, select
        count = (await db.execute(select(func.count()).select_from(KnowledgeIncident))).scalar_one()
        if count >= 3:
            return  # Already seeded

        seeds = [
            KnowledgeIncident(
                service="kartify",
                severity="CRITICAL",
                root_cause="Database connection pool exhausted due to leaked connections in product listing route",
                runbook_used="restart_backend",
                resolution_summary="Service restarted via admin recover endpoint. Connection pool cleared. All endpoints returned 200 within 8 seconds.",
                tags="connection pool,database,kartify,restart_backend,db pool exhausted",
                ts=datetime(2026, 8, 15, 14, 22, 0),
            ),
            KnowledgeIncident(
                service="kartify",
                severity="HIGH",
                root_cause="Memory leak in cart session handler caused OOM, forcing Node.js event loop stall",
                runbook_used="restart_backend",
                resolution_summary="Process restarted. Memory usage dropped from 1.8GB to 210MB. Cart and product APIs recovered.",
                tags="memory leak,oom,node.js,event loop,kartify,restart_backend",
                ts=datetime(2026, 8, 10, 9, 5, 0),
            ),
            KnowledgeIncident(
                service="payment-api",
                severity="CRITICAL",
                root_cause="Redis cache connection pool saturated under 10x traffic spike during sale event",
                runbook_used="restart_backend",
                resolution_summary="Service restart cleared cache pool. Implemented connection pool limit of 20 post-incident.",
                tags="redis,cache,connection pool,traffic spike,payment",
                ts=datetime(2026, 8, 1, 18, 45, 0),
            ),
        ]
        for s in seeds:
            db.add(s)
        await db.commit()
