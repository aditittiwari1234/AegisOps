"""
agents/action.py — Action Agent.
Executes the approved runbook via the Runbook Registry (HTTP hook only — no arbitrary shell).
"""
from __future__ import annotations
import httpx
from datetime import datetime
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Incident, RemediationAction
from ..runbooks.registry import get_runbook, is_allowed
from ..websocket.manager import ws_manager


class ActionOutput(BaseModel):
    runbook: str
    executed: bool
    http_status: int | None = None
    response_body: dict | None = None
    error: str | None = None


async def run(
    db: AsyncSession,
    incident: Incident,
    runbook_name: str,
) -> ActionOutput:
    await ws_manager.broadcast(
        incident_id=incident.id,
        event_type="agent.started",
        agent="action",
        status=incident.status,
        payload={"runbook": runbook_name},
    )

    # Safety gate: only execute runbooks in the allowlist
    if not is_allowed(runbook_name):
        result = ActionOutput(
            runbook=runbook_name,
            executed=False,
            error=f"Runbook '{runbook_name}' is not in the allowlist — execution blocked.",
        )
        await ws_manager.broadcast(
            incident_id=incident.id,
            event_type="agent.completed",
            agent="action",
            status=incident.status,
            payload=result.model_dump(),
        )
        return result

    runbook = get_runbook(runbook_name)
    action_record = RemediationAction(
        incident_id=incident.id,
        runbook_name=runbook_name,
        status="pending",
    )
    db.add(action_record)
    await db.commit()
    await db.refresh(action_record)

    if runbook.get("executor") == "stub":
        # Stub runbooks are logged but not executed
        action_record.status = "executed"
        action_record.executed_at = datetime.utcnow()
        action_record.response_json = {"stub": True}
        await db.commit()
        result = ActionOutput(runbook=runbook_name, executed=True, http_status=200, response_body={"stub": True})
    else:
        # HTTP hook executor
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.request(
                    method=runbook.get("method", "POST"),
                    url=runbook["url"],
                    headers=runbook.get("headers", {}),
                )
            action_record.status = "executed"
            action_record.executed_at = datetime.utcnow()
            action_record.response_json = {"status_code": resp.status_code, "body": resp.text[:500]}
            await db.commit()
            result = ActionOutput(
                runbook=runbook_name,
                executed=True,
                http_status=resp.status_code,
                response_body={"ok": resp.status_code < 400},
            )
        except Exception as exc:
            action_record.status = "failed"
            action_record.response_json = {"error": str(exc)}
            await db.commit()
            result = ActionOutput(runbook=runbook_name, executed=False, error=str(exc))

    await ws_manager.broadcast(
        incident_id=incident.id,
        event_type="agent.completed",
        agent="action",
        status=incident.status,
        payload=result.model_dump(),
    )
    return result
