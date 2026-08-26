# Architecture

AegisOps hackathon MVP — local processes, no Docker, Kartify as the monitored application.

## System diagram

```text
                    ┌─────────────────┐
                    │  React Dashboard │  :5173
                    │  (live timeline) │
                    └────────┬────────┘
                             │ HTTP + WebSocket
                             ▼
                    ┌─────────────────┐
                    │  FastAPI Backend │  :8000
                    │  Orchestrator    │
                    │  AI Agents       │
                    │  SQLite          │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌──────────────┐
     │  Gemini /  │  │  Incident  │  │  Kartify     │  :4000
     │  OpenRouter│  │  State DB  │  │  (monitored) │
     └────────────┘  └────────────┘  └──────┬───────┘
                                             │
                                    ┌────────▼────────┐
                                    │  AegisOps Agent │
                                    │  poll + recover │
                                    └─────────────────┘
```

## Components

### Kartify (monitored application)

- **Location:** [kartify/](../kartify/)
- **Role:** Real e-commerce app that AegisOps watches and heals
- **Stack:** Node.js `http` module, JSON file storage
- **Key endpoints:** `/api/products`, `/health`, `/admin/simulate-incident`, `/admin/recover`

### AegisOps Backend (control plane)

- **Location:** `backend/`
- **Role:** Incident lifecycle, AI agent orchestration, dashboard APIs, WebSocket events
- **Stack:** Python, FastAPI, SQLAlchemy, SQLite
- **Owns:** Incident state machine, LLM calls, audit log, knowledge storage

### AegisOps Agent (local executor)

- **Location:** `agent/`
- **Role:** Poll Kartify health/metrics, tail logs, execute approved runbooks
- **Stack:** Python, `httpx`, `psutil`
- **Does NOT:** Run arbitrary shell commands or call LLMs directly

### React Dashboard

- **Location:** `frontend/`
- **Role:** Incident list, live timeline, agent activity, simulate button
- **Stack:** React, TypeScript, Vite, Tailwind CSS

## Incident workflow

```text
DETECTED
   ↓
INVESTIGATING      ← Investigation Agent
   ↓
DIAGNOSING         ← Knowledge Agent + Root Cause Agent
   ↓
SAFETY_REVIEW      ← Safety Agent
   ↓
REMEDIATING        ← Action Agent → runbook engine
   ↓
VERIFYING          ← Verification Agent
   ↓
RESOLVED           ← store to knowledge_incidents
```

The orchestrator maintains explicit state in PostgreSQL/SQLite — not LLM conversation history.

## Detection vs AI agents

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| Rule engine | Poll `/health`, check error rate | Fast, reliable incident creation |
| Detection Agent (LLM) | Summarize after incident exists | Enrich severity and description |
| Investigation+ agents | Structured JSON analysis | Root cause and remediation plan |

Rules detect. LLMs investigate.

## Runbook execution flow

```text
Safety Agent approves "restart_backend"
        ↓
Orchestrator checks allowlist (ALLOWED_ACTIONS)
        ↓
Action Agent dispatches to runbook engine
        ↓
Agent POST http://localhost:4000/admin/recover
        ↓
Kartify failureMode = false → /api/products returns 200
```

The LLM never executes commands directly.

## Data stores

| Store | Technology | Contents |
|-------|------------|----------|
| Incident DB | SQLite (`backend/aegisops.db`) | incidents, events, agent_runs, actions, verification, knowledge |
| Kartify data | JSON files (`kartify/server/data/`) | products, users, carts, orders |

## WebSocket events

Backend pushes events to the dashboard on each state transition:

```json
{
  "type": "agent.completed",
  "incident_id": "uuid",
  "agent": "root_cause",
  "status": "DIAGNOSING",
  "payload": { "root_cause": "...", "confidence": 0.94 },
  "timestamp": "2026-08-27T00:00:00Z"
}
```

## Deferred (post-hackathon)

- Docker Compose packaging
- Remote VPS agent
- Prometheus / Grafana
- Redis job queue
- PostgreSQL (replace SQLite)
- Multi-tenant SaaS
- RAG / vector search for knowledge

See [hackathon-mvp.md](hackathon-mvp.md) for full scope boundaries.
