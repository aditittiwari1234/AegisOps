# Getting Started

Run AegisOps locally without Docker. All services are plain processes on your machine.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Backend, agent |
| Node.js | 16+ (18+ for dashboard) | Kartify, React frontend |
| Git | any | Clone repo |

Optional API keys (see [environment.md](environment.md)):

- **Google Gemini** — primary LLM (free tier via [Google AI Studio](https://aistudio.google.com/))
- **OpenRouter** — fallback free models

## 1. Clone and configure

```powershell
git clone <repo-url>
cd AegisOps
copy .env.example .env
```

Edit `.env` and set at least `GEMINI_API_KEY`.

## 2. Install dependencies

### Kartify (monitored app)

No npm install needed — Kartify uses only Node.js built-in modules.

```powershell
# Verify Kartify runs
node kartify/server/server.js
# → Kartify server running at http://localhost:4000
```

> **Note:** Kartify needs three admin routes added for AegisOps (`/health`, `/admin/simulate-incident`, `/admin/recover`). See [demo-scenario.md](demo-scenario.md).

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

### Agent

Uses the same Python venv as backend, or its own — follow `agent/requirements.txt` once created.

### Frontend

```powershell
cd frontend
npm install
cd ..
```

## 3. Start services

### Option A — launch script (recommended)

```powershell
.\scripts\start.ps1
```

### Option B — manual (four terminals)

**Terminal 1 — Kartify**

```powershell
node kartify/server/server.js
```

**Terminal 2 — Backend**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

**Terminal 3 — Agent**

```powershell
cd agent
..\backend\.venv\Scripts\Activate.ps1
python main.py
```

**Terminal 4 — Dashboard**

```powershell
cd frontend
npm run dev
```

## 4. Verify everything is up

| URL | Expected |
|-----|----------|
| http://localhost:4000 | Kartify storefront |
| http://localhost:4000/health | `{ "status": "ok", "service": "kartify" }` |
| http://localhost:8000/health | Backend health check |
| http://localhost:8000/docs | FastAPI Swagger UI |
| http://localhost:5173 | AegisOps dashboard |

## 5. Run the demo

1. Open the dashboard at http://localhost:5173
2. Confirm Kartify is healthy (green status or no active incidents)
3. Click **[Simulate Incident]**
4. Watch the incident timeline as agents run
5. Confirm status reaches **RESOLVED** and Kartify catalog works again

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 4000 in use | Set `PORT=4001` and update `KARTIFY_URL` in `.env` |
| Gemini API errors | Check `GEMINI_API_KEY`; switch to `LLM_PROVIDER=openrouter` |
| Agent can't reach Kartify | Confirm Kartify is running; check `KARTIFY_URL` |
| WebSocket not updating | Refresh dashboard; backend falls back to polling |

## Next steps

- [Architecture](architecture.md) — how components connect
- [Demo scenario](demo-scenario.md) — what happens during the demo
- [Agents](agents.md) — what each AI agent does
