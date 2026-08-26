# AegisOps — Tech Stack, Universal Architecture & Developer Vision

## 📋 Executive Summary

**AegisOps** is an autonomous AI-powered Incident Response & Site Reliability Engineering (SRE) platform. It continuously monitors software infrastructure, automatically detects outages, investigates root causes using a multi-agent AI team, executes safe pre-approved recovery runbooks, and verifies system recovery—reducing Mean Time to Resolution (MTTR) from **45 minutes to < 30 seconds**.

This document outlines:
1. **Tech Stack Strategy:** Production Vision vs. Pragmatic Hackathon MVP.
2. **Universal Compatibility:** How AegisOps works with ANY application stack (Node.js, Python, Java, Go, Kubernetes, Docker, Bare Metal).
3. **Non-Intrusive Architecture:** Why applications run in their native environments (not inside AegisOps).
4. **Production Deployment & Security:** Outbound telemetry streaming, zero-trust security, and cloud control plane architecture.
5. **Developer Onboarding (DX):** How third-party developers integrate AegisOps into their apps in under 3 minutes.

---

## 🛠️ 1. Tech Stack Strategy

```
+-----------------------------------------------------------------------------------+
|                                 REACT DASHBOARD                                   |
|                      (Vite + React 18 + WebSockets + Tailwind)                   |
+-----------------------------------------------------------------------------------+
                                          |
                               WebSocket / REST (Port 8000)
                                          v
+-----------------------------------------------------------------------------------+
|                                FASTAPI BACKEND                                    |
|         (Python 3.11+ | Orchestrator | Pydantic v2 | SQLite / SQLAlchemy)          |
+-----------------------------------------------------------------------------------+
                 |                                                  |
           LLM Calls (JSON Mode)                             HTTP Polling & Hooks
                 v                                                  v
+------------------------------------+             +--------------------------------+
|       LLM ENGINE (Primary/Fallback)|             |         LOCAL AGENT            |
| Primary: Gemini 2.0 Flash          |             | (Python daemon using psutil)   |
| Fallback: OpenRouter (Gemma/Llama) |             +--------------------------------+
+------------------------------------+                              |
                                                            Admin Recovery Hook
                                                                    v
                                                   +--------------------------------+
                                                   |       KARTIFY (Monitored App)   |
                                                   | (Node.js native http | Port 4000)|
                                                   +--------------------------------+
```

### Component Comparison Table

| Layer | Full Production Vision | Hackathon MVP Scope | Implementation Rationale |
| :--- | :--- | :--- | :--- |
| **Monitored Target** | Distributed Microservices | **Kartify** (`kartify/`) | Pre-existing Node.js e-commerce app requiring zero initial setup. Simple in-memory failure simulation hooks (`/admin/simulate-incident`, `/admin/recover`). |
| **Backend Framework** | FastAPI (Python 3.11+) | **FastAPI (Python 3.11+)** | Native async concurrency, WebSockets for live UI timeline streaming, auto OpenAPI docs, rich Pydantic v2 ecosystem. |
| **Database** | PostgreSQL + PGVector | **SQLite** (Async via SQLAlchemy) | Zero server install or container dependency. Upgrades seamlessly to PostgreSQL via connection string change. |
| **Task Queue / Cache** | Redis + Celery / ARQ | **In-Process `asyncio`** | In-process background tasks eliminate Redis overhead while maintaining state machine execution. |
| **AI / LLM Provider** | Generic LLM APIs | **Gemini 2.0 Flash** (Primary)<br>**OpenRouter** (Fallback) | Ultra-low latency (<1s response), high context window, strict JSON schema output (`response_schema`), generous free tier. |
| **Telemetry Collector** | OTel + Prometheus + Grafana | **Python Daemon** (`psutil`) | Direct process monitoring (CPU/RAM), console log capture, and HTTP `/health` polling without complex metrics infra. |
| **Frontend UI** | React Dashboard | **React 18 + Vite + Tailwind** | Instant HMR, clean UI, real-time WebSocket connection to backend for live agent execution feeds. |
| **Orchestration / Run** | Docker Compose + Remote VPS | **Local Process Script** (`start.ps1`) | Single command start across 4 local processes without Docker Desktop memory overhead or Windows networking quirks. |

---

## 🌐 2. Universal Application Architecture

AegisOps is designed to monitor **ANY application stack** (Node.js, Python, Java, Go, Rust, Ruby, C#, Docker, Kubernetes, AWS/GCP). It achieves universal compatibility through a **4-Pillar Adapter System**:

```
+-----------------------------------------------------------------------------------+
|                              AEGISOPS CONTROL PLANE                               |
|          (Multi-Agent AI Engine | Orchestrator | RAG Knowledge Base)            |
+-----------------------------------------------------------------------------------+
                                       ^
                           Outbound WSS / HTTPS Tunnel
                                       v
+-----------------------------------------------------------------------------------+
|                              AEGISOPS REMOTE AGENT                                |
|        (Lightweight Daemon / Sidecar / Systemd Service / K8s DaemonSet)           |
+-----------------------------------------------------------------------------------+
         |                                |                               |
  [ 📊 Telemetry Layer ]        [ ⚡ Runbook Engine ]           [ 🛡️ Safety & Health ]
  - OpenTelemetry / Logs         - Docker restart                - Custom HTTP / gRPC / DB
  - Prometheus / Metrics         - K8s `kubectl rollout`         - Process status
  - System Stats (CPU/RAM)       - Systemctl / HTTP Hooks        - Synthetic probes
         |                                |                               |
         v                                v                               v
+------------------+             +------------------+             +------------------+
|   Node.js App    |             |   Python / Django|             |   Java / Spring  |
|  (e.g., Kartify) |             |  Microservices   |             |   Monolith / K8s |
+------------------+             +------------------+             +------------------+
```

### The 4 Universal Pillars:

1. **Universal Telemetry Ingestion:** Reads logs from stdout/stderr, syslog, or log files. Parses multi-language stack traces (Node `TypeError`, Java `NullPointerException`, Python `Traceback`, Go `panic`).
2. **Declarative Runbook Framework:** AegisOps **never executes arbitrary AI-generated shell commands**. Infrastructure owners register approved runbooks (e.g., `restart_service`, `clear_cache`, `rollback_git_commit`).
3. **Protocol-Agnostic AI Reasoning:** Multi-agent team normalizes metrics & errors into structured Pydantic models regardless of target stack.
4. **Universal Verification Loop:** Post-remediation health validation (HTTP 200 probes, drop in error rates, CPU/RAM stabilization).

---

## 🏢 3. Non-Intrusive Environment Design

AegisOps **DOES NOT** require applications to run inside an AegisOps sandbox or proprietary cloud runtime.

```text
  YOUR EXISTING INFRASTRUCTURE                  AEGISOPS CONTROL PLANE
  (AWS / VPS / Kubernetes / Localhost)             (Cloud / Dashboard)
+------------------------------------+          +-------------------------+
|                                    |          |                         |
|   Your App (Node, Python, Java)    |          |   AI Agent Team         |
|                 |                  |          |   (Gemini Flash LLM)    |
|                 v                  |          |            ^            |
|   AegisOps Agent (Lightweight)     | <=======>|   Orchestrator          |
|   (Watches logs, metrics & health) |  WSS/    |            |            |
|                                    |  HTTPS   |   React Dashboard       |
+------------------------------------+          +-------------------------+
```

### Benefits of Non-Intrusive Monitoring:
* **Zero Migration & Zero Vendor Lock-in:** Applications remain on their existing AWS, GCP, Azure, Bare Metal, or Kubernetes infrastructure.
* **Security & Privacy:** Production user traffic stays on your servers. AegisOps only receives error logs and system metrics over an outbound encrypted channel.
* **Zero Inbound Port Exposure:** The AegisOps Agent connects *outbound* via WebSockets/HTTPS (`wss://aegisops.yourcompany.com`), removing the need to open inbound SSH or firewall ports.

---

## 🏭 4. Production Deployment & Security Model

In a production environment, deployment consists of two primary components:

### Deployment Breakdown

```text
 📱 YOUR MONITERED PRODUCTION SERVER                   ☁️ AEGISOPS CENTRAL CLOUD
 (e.g., AWS EC2, VPS, or K8s Cluster)                    (SaaS / Control Plane)
+------------------------------------+          +------------------------------------+
|                                    |          |                                    |
|  1. Your Production App            |          |  AegisOps Backend Engine           |
|     (e.g., Kartify, E-commerce API)|          |  (AI Agents, Root Cause Engine)    |
|                 |                  |          |                 |                  |
|          Writes stdout/logs        |          |                 v                  |
|                 v                  |  Secure  |  Web Dashboard UI                  |
|  2. AegisOps Agent (Tiny Daemon)   | -------->|  (Where YOU log in to view:        |
|     (Reads logs, CPU/RAM, /health) | Outbound |   - Real-time Error Logs           |
|                                    |  WSS     |   - AI Investigation Timeline      |
|                                    |          |   - Root Cause & Recovery Actions) |
+------------------------------------+          +------------------------------------+
```

1. **AegisOps Agent (~10MB Daemon):** Installed on the application host/cluster. Tails logs, polls `/health`, checks CPU/RAM, and streams anomalies.
2. **AegisOps Cloud Control Plane:** Central hosted platform where AI agents analyze telemetry, manage incident state, and render the developer dashboard.
3. **Log Aggregator Integrations:** Alternatively, AegisOps can ingest logs directly from **Datadog, Grafana Loki, AWS CloudWatch, or OpenTelemetry** via API.

---

## 🚀 5. Developer Onboarding Journey (DX)

Any developer can connect their application to AegisOps in under **3 minutes** without changing a single line of application code.

### Step 1: Create Project in AegisOps Dashboard
The developer logs into the AegisOps Dashboard, creates a project, and receives an **API Key**:
```text
Project Name:  My-Payment-API
API Key:       aegis_live_9f8a7b6c5d4e3f2a1
```

### Step 2: Install AegisOps Agent (1 Command)

* **Linux / VPS:**
  ```bash
  curl -sSL https://get.aegisops.io | AEGISOPS_API_KEY=aegis_live_9f8a7b6c5d4e3f2a1 sh
  ```
* **Docker (`docker-compose.yml`):**
  ```yaml
  services:
    my-app:
      image: my-company/my-app:latest
      ports:
        - "8080:8080"

    aegisops-agent:
      image: aegisops/agent:latest
      environment:
        - AEGISOPS_API_KEY=aegis_live_9f8a7b6c5d4e3f2a1
        - TARGET_APP_URL=http://my-app:8080
      volumes:
        - /var/run/docker.sock:/var/run/docker.sock
  ```
* **Kubernetes:**
  ```bash
  helm install aegisops-agent aegisops/agent --set apiKey=aegis_live_9f8a7b6c5d4e3f2a1
  ```

### Step 3: Define Permitted Runbooks (`aegisops.yaml`)
Developers add a small declarative config file in their repository:

```yaml
# aegisops.yaml
version: "1.0"
service_name: "payment-service"

health_check:
  url: "http://localhost:8080/health"
  interval_seconds: 5

allowed_runbooks:
  - name: restart_service
    action: "docker restart payment-service"
    risk: LOW
    auto_approve: true

  - name: clear_redis_cache
    action: "redis-cli flushdb"
    risk: LOW
    auto_approve: true

  - name: rollback_commit
    action: "git checkout HEAD~1 && npm restart"
    risk: MEDIUM
    auto_approve: false # Requires 1-click human approval via Slack/Dashboard
```

### Step 4: Automatic Detection, Diagnosis & Self-Healing
When an incident occurs (e.g. Connection Pool Exhaustion):
1. **Detect:** Agent detects HTTP 500 / health failure.
2. **Investigate:** Gemini 2.0 Flash reads stack trace logs and identifies connection leak.
3. **Safety Gate:** AegisOps verifies `restart_service` is pre-approved in `aegisops.yaml`.
4. **Remediate:** Agent executes `docker restart payment-service`.
5. **Verify:** Agent confirms `/health` returns HTTP 200 OK.
6. **Notify:** Developer receives Slack alert + detailed post-mortem report in the AegisOps Dashboard.

---

## 📈 Summary Comparison

| Metric | Traditional Monitoring (Datadog/PagerDuty) | AegisOps Autonomous SRE |
| :--- | :--- | :--- |
| **Integration** | Requires custom SDKs / code hooks | **Zero code changes** (Outbound agent / OTel) |
| **3 AM Incidents** | PagerDuty wakes up engineer at 3 AM | **AegisOps auto-heals in 15 seconds** |
| **Investigation** | Manual log filtering & metric correlation | **Multi-agent AI root-cause analysis** |
| **Action** | Read-only graphs & manual shell scripts | **Safe, permissioned automated runbooks** |
