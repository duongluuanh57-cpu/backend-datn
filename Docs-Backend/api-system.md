# System Endpoints

## Health Check

```http
GET /health
```

Response `200`:
```json
{ "status": "healthy", "uptime": 123456, "database": "connected", "redis": "connected", "timestamp": "iso" }
```

Degraded: `{ "status": "degraded", "database": "connected", "redis": "disconnected" }` — `200`
Unhealthy: `{ "status": "unhealthy" }` — `503`

## Ping

```http
GET /ping
```

Response `200` — `{ "pong": true, "warmed": true }`

Used for warmup detection.

## Metrics (Prometheus)

```http
GET /metrics
```

Response `200` — Prometheus text format metrics.

## Root

```http
GET /
```

Response `200` — `{ "name": "Perfume API", "version": "1.0.0", "docs": "/docs" }`

---

# Background Jobs (QStash)

All jobs are POST-only, verified via QStash signature.

```http
POST /api/jobs/welcome-email
```
Sends welcome email to newly registered users.

```http
POST /api/jobs/daily-cleanup
```
Cleans expired tokens, temp files, stale sessions.

```http
POST /api/jobs/self-heal
```
Checks service health and restarts degraded services.

```http
POST /api/jobs/failover-check
```
Verifies failover database replicas are in sync.

---

# Content Search

```http
GET /api/content/search?q=perfume&type=products|brands|categories
```

Response `200`:
```json
{ "results": { "products": [...], "brands": [...], "categories": [...] } }
```

---

# Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource / state conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

Error response shape:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Email is required", "details": [{ "field": "email", "message": "must be a valid email" }] } }
```
