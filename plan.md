# AegisOps — Prototype Development Plan

## 1. Project Overview

AegisOps is an AI-powered incident response platform for software systems.

It acts like an AI emergency operations team:

**Detect → Investigate → Diagnose → Plan → Safety Check → Act → Verify → Learn**

AegisOps is not limited to localhost. The prototype will support both:

- Local development/demo infrastructure
- Remote internet-connected servers through a secure AegisOps Agent

The goal is to build a working prototype that can detect a simulated production incident, investigate it using multiple specialized AI agents, choose a safe remediation, execute an approved action, and verify recovery.

---

# 2. Prototype Goal

Build a working end-to-end demonstration where:

1. A monitored application is running.
2. A failure is intentionally introduced.
3. AegisOps detects the failure.
4. Logs and metrics are collected.
5. Multiple AI agents investigate the incident.
6. The root cause is identified.
7. A safety agent evaluates possible fixes.
8. A controlled remediation is executed.
9. A verification agent confirms recovery.
10. The dashboard shows the complete incident timeline.
11. The resolved incident is stored for future knowledge retrieval.

---

# 3. Core Architecture

```text
                         INTERNET
                            |
                  +---------+---------+
                  |                   |
                  v                   v
          Monitored Server      AegisOps Cloud
                  |                   |
          +-------+-------+     +-----+------+
          | Application   |     | FastAPI    |
          | Docker        |     | Orchestrator
          | PostgreSQL    |     | AI Agents  |
          | Redis         |     | PostgreSQL  |
          +-------+-------+     | Knowledge  |
                  |             +-----+------+
                  |                   |
            AegisOps Agent            |
                  |                   |
                  +---- HTTPS/WSS ---+
                                      |
                                      v
                              React Dashboard
```

For the first local prototype:

```text
+------------------------------------------------+
|                 Docker Compose                 |
|                                                |
|  Demo API  <----> PostgreSQL                   |
|      |                                         |
|      +----> Redis                              |
|                                                |
|  AegisOps Backend                              |
|  AegisOps Agent                                |
|  Prometheus                                    |
|  Grafana                                       |
+------------------------------------------------+
                     |
                     v
              React Dashboard
```

---

# 4. System Components

## 4.1 AegisOps Cloud

The central control plane.

Responsibilities:

- Receive telemetry from agents
- Create and manage incidents
- Orchestrate AI agents
- Store incidents
- Store agent decisions
- Store audit logs
- Manage remediation policies
- Trigger approved actions
- Verify recovery
- Provide dashboard APIs
- Provide WebSocket events for live UI updates

Recommended stack:

- Python
- FastAPI
- PostgreSQL
- Redis
- WebSockets
- Docker

---

# 5. AegisOps Remote Agent

The remote agent runs inside or near the infrastructure being monitored.

Example:

```text
Customer VPS

+--------------------------------+
|                                |
|  Nginx                         |
|  Backend API                   |
|  PostgreSQL                    |
|  Redis                         |
|                                |
|  AegisOps Agent                |
|                                |
+----------------+---------------+
                 |
             HTTPS/WSS
                 |
                 v
          AegisOps Cloud
```

The agent should collect:

- Application logs
- Docker container status
- CPU usage
- Memory usage
- Disk usage
- Network information
- Health endpoint results
- Service status
- Selected application metrics

The agent should establish outbound connections rather than requiring AegisOps to expose unrestricted SSH access.

---

# 6. AI Agent Team

## 6.1 Detection Agent

Purpose:

Identify abnormal behavior.

Inputs:

- Metrics
- Alerts
- Logs
- Health checks

Outputs:

```json
{
  "incident_detected": true,
  "severity": "critical",
  "service": "payment-api",
  "reason": "HTTP 500 rate exceeded threshold"
}
```

---

## 6.2 Investigation Agent

Purpose:

Collect and analyze evidence.

It should investigate:

- Recent logs
- Error patterns
- Service status
- Recent deployments
- Configuration changes
- Resource usage
- Related services

Output:

- Evidence
- Timeline
- Suspicious changes
- Affected components

---

## 6.3 Knowledge Agent

Purpose:

Search previous incidents and documentation.

Example:

```text
Current incident:
Database connection pool exhausted

Previous incidents:
INC-102
INC-087
INC-041
```

It returns similar incidents and successful remediation history.

Initial implementation can use PostgreSQL full-text search.

Later:

- Embeddings
- Vector database
- RAG
- Semantic incident search

---

## 6.4 Root Cause Agent

Purpose:

Determine the most likely root cause.

It must not blindly guess.

Output:

```json
{
  "root_cause": "Database connection pool exhaustion",
  "confidence": 0.94,
  "evidence": [
    "Connection timeout errors",
    "Pool reached maximum size",
    "Issue started after deployment"
  ]
}
```

---

## 6.5 Safety Agent

Purpose:

Determine whether a proposed remediation is safe.

It evaluates:

- Action risk
- Blast radius
- Production impact
- Reversibility
- Required permissions
- Whether human approval is required

Example:

```text
Restart API              LOW
Rollback deployment      MEDIUM
Delete database records  HIGH
```

The Safety Agent must never bypass predefined security policies.

---

## 6.6 Action Agent

Purpose:

Execute approved remediation.

The AI must NOT receive unrestricted shell access.

Use a Runbook Engine.

Example approved actions:

```text
restart_backend
restart_redis
restart_nginx
rollback_deployment
clear_cache
scale_service
```

Each action maps to controlled code.

Example:

```text
restart_backend
       |
       v
Action Engine
       |
       v
docker restart backend
```

Never allow arbitrary AI-generated commands to execute automatically.

---

## 6.7 Verification Agent

Purpose:

Prove that the incident is actually resolved.

Checks:

- HTTP health endpoint
- HTTP error rate
- Response latency
- Container status
- CPU/RAM
- Logs
- Service availability

Example:

```text
Before:
Error rate = 42%

Action:
Restart backend

After:
Error rate = 0.4%
Health = 200
Container = Running

Result:
RECOVERED
```

---

# 7. Orchestrator

The orchestrator controls the incident workflow.

```text
Incident
   |
   v
Detection
   |
   v
Investigation
   |
   v
Knowledge Search
   |
   v
Root Cause
   |
   v
Remediation Plan
   |
   v
Safety Check
   |
   +---- Unsafe ----> Human Approval
   |
   +---- Safe ------> Action
                         |
                         v
                     Verification
                         |
                  +------+------+
                  |             |
                Failed       Success
                  |             |
                  v             v
              Investigate    Resolve
                  |
                  v
              Retry/Plan
```

The orchestrator should maintain explicit incident state instead of relying only on LLM conversation.

---

# 8. Incident Lifecycle

Every incident should have a state.

Recommended states:

```text
DETECTED
INVESTIGATING
DIAGNOSING
PLANNING
SAFETY_REVIEW
AWAITING_APPROVAL
REMEDIATING
VERIFYING
RESOLVED
FAILED
ESCALATED
```

Example:

```text
INC-1001

DETECTED
   ↓
INVESTIGATING
   ↓
DIAGNOSING
   ↓
SAFETY_REVIEW
   ↓
REMEDIATING
   ↓
VERIFYING
   ↓
RESOLVED
```

---

# 9. Demo Scenario

The first complete demo should use a simple API.

## Normal State

```text
GET /health

200 OK
```

Metrics:

```text
Error Rate: 0.2%
Latency: 120ms
CPU: 32%
Memory: 48%
```

## Trigger Incident

Provide a dashboard button:

```text
[ Simulate Incident ]
```

The button intentionally causes the demo API to fail.

For example:

```text
GET /api/payment

500 Internal Server Error
```

The system generates repeated database connection errors.

---

# 10. Expected Demo Flow

```text
User clicks "Simulate Incident"

        ↓

Demo API starts failing

        ↓

Detection Agent
"Abnormal 500 error rate detected"

        ↓

Investigation Agent
"Database connection errors found"

        ↓

Knowledge Agent
"Similar incidents found"

        ↓

Root Cause Agent
"Database connection pool exhausted"

        ↓

Safety Agent
"Restarting backend is low risk"

        ↓

Action Agent
"Restart backend"

        ↓

Verification Agent

Health: 200
Error rate: 0.3%
Latency: normal

        ↓

INCIDENT RESOLVED
```

This should be the main hackathon demonstration.

---

# 11. Dashboard

Build the frontend using:

- React
- TypeScript
- Vite
- Tailwind CSS

Main pages:

## Dashboard

Show:

- Active incidents
- Severity
- Service health
- Agent activity
- Recovery statistics

## Incident Details

Show:

- Incident ID
- Service
- Severity
- Root cause
- Confidence
- Evidence
- Recommended action
- Safety assessment
- Action result
- Verification result

## Agent Activity

Show each agent:

```text
Detection       ✓ Complete
Investigation   ✓ Complete
Knowledge       ✓ Complete
Root Cause      ✓ Complete
Safety          ✓ Approved
Action          ✓ Executed
Verification    ✓ Recovered
```

## Live Timeline

Example:

```text
22:10:01  Incident detected
22:10:03  Logs collected
22:10:07  Root cause identified
22:10:10  Safety check completed
22:10:12  Remediation executed
22:10:18  Health check passed
22:10:20  Incident resolved
```

---

# 12. Database

Use PostgreSQL.

Initial tables:

## incidents

```text
id
incident_number
service
severity
status
description
root_cause
confidence
created_at
resolved_at
```

## incident_events

```text
id
incident_id
event_type
agent
message
metadata
created_at
```

## agent_runs

```text
id
incident_id
agent_name
status
input
output
started_at
completed_at
```

## remediation_actions

```text
id
incident_id
action_name
risk_level
approved
executed
result
created_at
```

## verification_results

```text
id
incident_id
health_status
error_rate
latency
service_status
passed
created_at
```

## knowledge_incidents

```text
id
incident_id
summary
root_cause
solution
success
created_at
```

---

# 13. Security Model

Security is a major part of AegisOps.

## Never do this

```text
LLM
 ↓
arbitrary shell command
 ↓
production server
```

## Do this

```text
LLM
 ↓
Proposed Action
 ↓
Safety Policy
 ↓
Allowed Runbook?
 ↓
Permission Check
 ↓
Approval Policy
 ↓
Action Engine
 ↓
Execution
```

Every action must have:

- Actor
- Timestamp
- Incident ID
- Reason
- Approved action
- Target
- Result

---

# 14. Human Approval

Actions can have different policies.

```text
LOW RISK
Restart application
        ↓
Automatic

MEDIUM RISK
Rollback deployment
        ↓
Optional approval

HIGH RISK
Database modification
        ↓
Mandatory human approval
```

The dashboard should provide:

```text
[ Approve ]
[ Reject ]
```

for actions requiring human approval.

---

# 15. Internet Architecture

After the localhost prototype works, deploy:

```text
                INTERNET
                    |
        +-----------+-----------+
        |                       |
        v                       v
  Monitored VPS          AegisOps Cloud
                              |
                       +------+------+
                       |             |
                    FastAPI       PostgreSQL
                       |
                  AI Orchestrator
                       |
                +------+------+
                |             |
            AI Agents     Runbooks
                |
                v
         React Dashboard
```

The monitored server runs:

```text
AegisOps Agent
```

The agent communicates with AegisOps Cloud using secure outbound HTTPS/WebSocket connections.

---

# 16. Multi-Tenant Future Architecture

For a real SaaS product:

```text
                    AegisOps Cloud
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
       Tenant A          Tenant B          Tenant C
          |                |                |
       Agent A           Agent B           Agent C
          |                |                |
      AWS/VPS          Kubernetes         Azure
```

Every tenant must have isolated:

- Data
- Credentials
- Agents
- Permissions
- Incidents
- Runbooks
- Audit logs

This is not required for the first prototype.

---

# 17. Technology Stack

## Frontend

```text
React
TypeScript
Vite
Tailwind CSS
WebSocket
```

## Backend

```text
Python
FastAPI
SQLAlchemy
Pydantic
WebSockets
```

## Database

```text
PostgreSQL
Redis
```

## AI

Start with an LLM API.

Use structured JSON outputs from agents.

Do not start with a complicated multi-agent framework unless it actually simplifies the implementation.

## Infrastructure

```text
Docker
Docker Compose
Prometheus
Grafana
```

## Remote Agent

Start with:

```text
Python
FastAPI/async client
Docker SDK
psutil
```

---

# 18. Recommended Repository Structure

```text
aegisops/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── agents/
│   │   │   ├── detection.py
│   │   │   ├── investigation.py
│   │   │   ├── knowledge.py
│   │   │   ├── root_cause.py
│   │   │   ├── safety.py
│   │   │   ├── action.py
│   │   │   └── verification.py
│   │   │
│   │   ├── orchestrator/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── runbooks/
│   │   ├── websocket/
│   │   ├── database.py
│   │   └── main.py
│   │
│   ├── prompts/
│   └── requirements.txt
│
├── agent/
│   ├── collectors/
│   ├── actions/
│   ├── health/
│   └── main.py
│
├── demo/
│   ├── api/
│   ├── docker-compose.yml
│   └── failure-scenarios/
│
├── infrastructure/
│   ├── docker/
│   ├── prometheus/
│   └── grafana/
│
├── docs/
│
├── .env.example
├── docker-compose.yml
├── README.md
└── plan.md
```

---

# 19. Development Phases

## Phase 1 — Foundation

- Create repository
- Create FastAPI backend
- Create React frontend
- Configure PostgreSQL
- Configure Docker Compose
- Create database models
- Create WebSocket connection

Goal:

```text
React ↔ FastAPI ↔ PostgreSQL
```

---

## Phase 2 — Monitoring

Implement:

- Demo API
- Health checks
- Log collection
- CPU/RAM monitoring
- Incident creation
- Detection rules

Goal:

```text
Failure → Incident
```

---

## Phase 3 — AI Investigation

Implement:

- Detection Agent
- Investigation Agent
- Knowledge Agent
- Root Cause Agent

Goal:

```text
Incident → Root Cause
```

---

## Phase 4 — Remediation

Implement:

- Safety Agent
- Runbook Engine
- Action Agent
- Approval system

Goal:

```text
Root Cause → Safe Action
```

---

## Phase 5 — Verification

Implement:

- Health checks
- Metrics comparison
- Log verification
- Recovery decision
- Incident resolution

Goal:

```text
Action → Verified Recovery
```

---

## Phase 6 — Knowledge

Store resolved incidents.

Implement:

- Similar incident search
- Successful remediation search
- Incident summaries
- RAG/vector search later

Goal:

```text
Past incidents → Better future investigation
```

---

## Phase 7 — Remote Internet Agent

Build the AegisOps Agent.

Implement:

- Secure registration
- Agent authentication
- Telemetry upload
- Remote health checks
- Controlled action execution
- Heartbeat

Goal:

```text
Remote Server → AegisOps Cloud
```

---

# 20. MVP Definition

The prototype is considered complete when this works:

```text
Remote/Local Application
        ↓
Failure
        ↓
Detection
        ↓
Investigation
        ↓
Root Cause
        ↓
Safety Decision
        ↓
Approved Remediation
        ↓
Verification
        ↓
Resolved Incident
        ↓
Stored Knowledge
```

And the dashboard visibly shows the complete process.

---

# 21. What NOT to Build Initially

Avoid these in Version 1:

- Full Kubernetes management
- AWS-wide automation
- Automatic database migrations
- Arbitrary shell commands
- Multi-region infrastructure
- Complex multi-tenant billing
- Fully autonomous high-risk production changes
- Training your own LLM
- Dozens of AI agents
- Complex vector infrastructure before basic search works

Focus on the complete incident lifecycle.

---

# 22. First Demo Scenarios

Implement 3 scenarios.

## Scenario 1 — Backend Crash

```text
Backend stops
↓
Detection
↓
Restart backend
↓
Health check
↓
Resolved
```

## Scenario 2 — High Error Rate

```text
API returns 500
↓
Investigate logs
↓
Find recent deployment
↓
Recommend rollback
↓
Safety approval
↓
Rollback
↓
Verify
```

## Scenario 3 — Disk Almost Full

```text
Disk > 90%
↓
Find large logs
↓
Suggest log rotation
↓
Safety check
↓
Run approved cleanup
↓
Verify disk space
```

---

# 23. Success Metrics

Track:

- Mean Time to Detect (MTTD)
- Mean Time to Resolve (MTTR)
- Detection accuracy
- Root cause confidence
- Remediation success rate
- Verification success rate
- False positive rate
- Human approval rate

Example dashboard:

```text
MTTD             8 sec
MTTR             24 sec
Detection        97%
Remediation      94%
Verification     100%
```

For the prototype, these can be measured from simulated incidents.

---

# 24. Final Product Vision

AegisOps should eventually become:

> An AI-powered autonomous SRE platform that continuously monitors software infrastructure, investigates incidents, determines probable root causes, safely executes approved remediation workflows, verifies recovery, and learns from previous incidents.

The core product loop remains:

```text
       ┌───────────────┐
       │    DETECT     │
       └───────┬───────┘
               ↓
       ┌───────────────┐
       │  INVESTIGATE  │
       └───────┬───────┘
               ↓
       ┌───────────────┐
       │    DIAGNOSE   │
       └───────┬───────┘
               ↓
       ┌───────────────┐
       │ SAFETY CHECK  │
       └───────┬───────┘
               ↓
       ┌───────────────┐
       │     ACT       │
       └───────┬───────┘
               ↓
       ┌───────────────┐
       │    VERIFY     │
       └───────┬───────┘
               ↓
       ┌───────────────┐
       │     LEARN     │
       └───────┬───────┘
               │
               └──────────→ Next Incident
```

# 25. Immediate Next Steps

Build in this exact order:

1. Create `aegisops` repository.
2. Create `plan.md`.
3. Set up Docker Compose.
4. Create FastAPI backend.
5. Create PostgreSQL database.
6. Create demo API.
7. Create React dashboard.
8. Implement WebSocket live events.
9. Implement incident model.
10. Implement detection engine.
11. Implement Investigation Agent.
12. Implement Root Cause Agent.
13. Implement Safety Agent.
14. Implement Runbook Engine.
15. Implement Action Agent.
16. Implement Verification Agent.
17. Add incident knowledge storage.
18. Add AegisOps remote agent.
19. Deploy AegisOps Cloud.
20. Connect a remote VPS and demonstrate a real internet-based incident.

**The first milestone is not "build an AI platform." The first milestone is:**

> **Break a real service → AegisOps investigates it → performs one safe predefined recovery → proves the service recovered.**

Once that loop works reliably, the rest of the platform can be built around it.
