# AegisOps

AI-powered incident response platform for software systems. AegisOps acts like an AI emergency operations team:

**Detect → Investigate → Diagnose → Plan → Safety Check → Act → Verify → Learn**

## Hackathon MVP

This prototype monitors **[Kartify](kartify/)** — a local Node.js e-commerce app — detects simulated failures, runs a pipeline of specialized AI agents, executes a safe predefined recovery action, and verifies the service recovered.

| Component | Stack | Port |
|-----------|-------|------|
| Monitored app (Kartify) | Node.js | 4000 |
| AegisOps Backend | Python / FastAPI | 8000 |
| AegisOps Agent | Python | — |
| Dashboard | React / TypeScript / Vite | 5173 |

**No Docker required.** Everything runs as local processes with SQLite for incident storage.

## Quick start

Prerequisites: **Python 3.11+**, **Node.js 18+**

```powershell
# 1. Copy environment template and add your API keys
copy .env.example .env

# 2. Start all services (once scripts are implemented)
.\scripts\start.ps1
```

Then open:

- **Dashboard:** http://localhost:5173
- **Kartify:** http://localhost:4000
- **Backend API:** http://localhost:8000/docs

See [docs/getting-started.md](docs/getting-started.md) for full setup instructions.

## Demo flow

1. Kartify runs normally — product catalog loads at http://localhost:4000
2. Click **[Simulate Incident]** on the AegisOps dashboard
3. Kartify starts returning 500 errors on `/api/products`
4. AegisOps detects the failure, AI agents investigate and identify root cause
5. Safety agent approves `restart_backend` (LOW risk, auto-approved)
6. Agent calls `POST /admin/recover` on Kartify
7. Verification confirms health restored → incident **RESOLVED**

See [docs/demo-scenario.md](docs/demo-scenario.md) for the full walkthrough.

## Documentation

| Doc | Description |
|-----|-------------|
| [plan.md](plan.md) | Full product and architecture plan |
| [docs/hackathon-mvp.md](docs/hackathon-mvp.md) | Scoped MVP decisions for the hackathon build |
| [docs/getting-started.md](docs/getting-started.md) | Local setup and running services |
| [docs/architecture.md](docs/architecture.md) | System design and component responsibilities |
| [docs/agents.md](docs/agents.md) | AI agent team roles and outputs |
| [docs/environment.md](docs/environment.md) | Environment variables reference |
| [kartify/README.md](kartify/README.md) | Monitored e-commerce app |

## Project structure

```text
AegisOps/
├── kartify/          # Monitored app (Node.js e-commerce)
├── backend/          # FastAPI orchestrator + AI agents
├── agent/            # Local telemetry collector + runbook executor
├── frontend/         # React dashboard
├── docs/             # Documentation
├── scripts/          # start.ps1 / start.sh launchers
├── plan.md
└── README.md
```

## Security model

The LLM **never** gets unrestricted shell access. It proposes actions; a fixed **runbook engine** executes only allowlisted operations after a safety check.

```text
LLM → Proposed Action → Safety Policy → Allowlist Check → Action Engine → Execution
```

## License

MIT
