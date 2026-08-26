# Demo Scenario

The hackathon demo uses **one scenario**: Kartify product API failure with automated recovery.

## Normal state

| Check | Expected |
|-------|----------|
| `GET http://localhost:4000/health` | `{ "status": "ok", "service": "kartify" }` |
| `GET http://localhost:4000/api/products` | 200, product list returned |
| Dashboard | No active incidents, Kartify healthy |

## Trigger: simulate incident

From the AegisOps dashboard, click **[Simulate Incident]**.

This calls:

```http
POST http://localhost:4000/admin/simulate-incident
x-admin-key: admin123
```

Kartify sets an in-memory `failureMode = true`.

## Failure state

| Check | Expected |
|-------|----------|
| `GET /api/products` | **500** — `{ "error": "Database connection pool exhausted" }` |
| `GET /health` | `{ "status": "unhealthy", "service": "kartify" }` |
| Server logs | `[ERROR] Database connection pool exhausted — max connections reached` |

The storefront product catalog breaks — a realistic user-facing failure.

## AegisOps response

### 1. Detection (rule engine)

Agent polls every 5 seconds. When `/health` is unhealthy or `/api/products` returns 500:

- Create incident `INC-1001`, status `DETECTED`, service `kartify`, severity `critical`

### 2. Detection Agent (LLM)

Enriches the incident:

```json
{
  "incident_detected": true,
  "severity": "critical",
  "service": "kartify",
  "reason": "HTTP 500 rate exceeded threshold on /api/products"
}
```

### 3. Investigation Agent

Analyzes logs and telemetry:

```json
{
  "evidence": [
    "Connection timeout errors in server logs",
    "GET /api/products returning 500",
    "Failure started after simulate-incident trigger"
  ],
  "affected_components": ["kartify", "product-catalog"]
}
```

### 4. Knowledge Agent

Searches past incidents in SQLite:

```text
Similar past incidents:
- INC-087: Database connection pool exhausted → restart_backend → recovered
```

(Seed 2–3 fake past incidents so this step isn't empty on first demo.)

### 5. Root Cause Agent

```json
{
  "root_cause": "Database connection pool exhaustion",
  "confidence": 0.94,
  "evidence": [
    "Connection timeout errors",
    "Pool reached maximum size",
    "Product API failing consistently"
  ]
}
```

### 6. Safety Agent

```json
{
  "recommended_action": "restart_backend",
  "risk_level": "LOW",
  "auto_approve": true,
  "reason": "Restart clears connection pool state; reversible; no data loss"
}
```

### 7. Action Agent

Executes allowlisted runbook:

```http
POST http://localhost:4000/admin/recover
x-admin-key: admin123
```

Kartify sets `failureMode = false`.

### 8. Verification Agent

Polls 3 times over 10 seconds:

| Metric | Before | After |
|--------|--------|-------|
| `/health` | unhealthy | ok |
| `/api/products` | 500 | 200 |
| Error rate | ~100% | ~0% |

Result: **RECOVERED** → incident status `RESOLVED`.

### 9. Learn

Write to `knowledge_incidents`:

```json
{
  "summary": "Kartify product API 500 errors due to connection pool exhaustion",
  "root_cause": "Database connection pool exhaustion",
  "solution": "restart_backend via /admin/recover",
  "success": true
}
```

## Dashboard timeline (example)

```text
22:10:01  Incident detected
22:10:03  Investigation complete — connection errors found
22:10:05  Knowledge search — 2 similar incidents
22:10:07  Root cause identified — pool exhaustion (94% confidence)
22:10:09  Safety check passed — restart_backend approved (LOW)
22:10:10  Remediation executed — /admin/recover
22:10:18  Verification passed — health 200, error rate normal
22:10:20  Incident resolved
```

## Kartify hooks required

Add to [kartify/server/server.js](../kartify/server/server.js):

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/health` | GET | None | Health probe |
| `/admin/simulate-incident` | POST | `x-admin-key` | Trigger failure mode |
| `/admin/recover` | POST | `x-admin-key` | Clear failure mode (runbook target) |

When `failureMode` is true, wrap `listProducts()` to return 500 and log errors.

## Manual testing (curl)

```powershell
# Normal
curl http://localhost:4000/health
curl http://localhost:4000/api/products

# Break it
curl -X POST http://localhost:4000/admin/simulate-incident -H "x-admin-key: admin123"

# Confirm broken
curl http://localhost:4000/api/products

# Fix it
curl -X POST http://localhost:4000/admin/recover -H "x-admin-key: admin123"

# Confirm fixed
curl http://localhost:4000/api/products
```

## Out of scope for this demo

- Scenario 2: deployment rollback
- Scenario 3: disk full / log rotation
- Human approval UI (MEDIUM/HIGH risk actions)
- Remote VPS monitoring
