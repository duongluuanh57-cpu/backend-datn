# Failover & Self-Healing

## SelfHealingService

**checkRedisHealth()**
- Checks `used_memory / maxmemory` via `redis.info('memory')`
- If > 80% → scan & delete `ai_cache:*` keys (batch 100, cursor-based)
- Logs action + sends PostHog event

**checkDatabaseConnection()**
- Checks `mongoose.connection.readyState`
- If disconnected → calls `mongoose.connect()` to reconnect

**performMaintenance()**
- Runs both checks above — triggered by QStash cron hourly (`POST /api/jobs/self-heal`)

## FailoverService

**Config:** `REGION`, `SECONDARY_REGION_URL`, Cloudflare API token (optional)

**monitorAndFailover() — cron every 5 min:**
1. `runHealthChecks()` → healthy / degraded / unhealthy
2. If unhealthy:
   - With Cloudflare API: disable LB pool, route to secondary region
   - Without API: log secondary region URL for manual action
   - Send PostHog alert

## QStash Cron Jobs

| Endpoint | Cron | Purpose |
|----------|------|---------|
| `POST /api/jobs/self-heal` | hourly | Redis/DB health + cache cleanup |
| `POST /api/jobs/failover-check` | every 5 min | Region health → failover |
| `POST /api/jobs/daily-cleanup` | daily | Session/token cleanup |
| `POST /api/jobs/welcome-email` | on event | Welcome email |

All jobs verified by `qstashMiddleware` (HMAC signature + Redis idempotency).

## MongoDB Connection
```ts
{ maxPoolSize: 50, minPoolSize: 5, serverSelectionTimeoutMS: 15000, socketTimeoutMS: 45000 }
```
Backup: `mongodump` / MongoDB Atlas daily auto-backup (7 day retention).
