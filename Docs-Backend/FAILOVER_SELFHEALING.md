# Failover & Self-Healing — Elite SaaS Backend

## 1. SelfHealingService (`src/services/SelfHealingService.ts`)

**Mục đích:** Tự động phát hiện và xử lý các sự cố hạ tầng.

### checkRedisHealth()

Dùng `redis.info('memory')` để parse real memory usage:

```
used_memory: bytes đang dùng
maxmemory: bytes tối đa (0 = no limit)
```

- Nếu `used / max > 80%` → scan keys `ai_cache:*` bằng SCAN (cursor-based, không block Redis)
- Xoá từng batch 100 keys, ghi log tổng số keys đã xoá
- Gửi event lên PostHog: `self_healing_action` với action, reason, usagePercent, deletedKeys

### checkDatabaseConnection()

Kiểm tra `mongoose.connection.readyState`:
- `0` = disconnected
- `1` = connected
- `2` = connecting
- `3` = disconnecting

Nếu `readyState !== 1` → gọi `mongoose.connect()` lại.

### performMaintenance()

Chạy cả 2 checks trên, được gọi từ QStash cron hàng giờ.

---

## 2. FailoverService (`src/services/FailoverService.ts`)

**Mục đích:** Phát hiện sự cố region và điều hướng traffic.

### Config

| Env Variable | Description |
|-------------|-------------|
| `REGION` | Region hiện tại (VD: `singapore`) |
| `SECONDARY_REGION_URL` | URL region dự phòng |
| `CLOUDFLARE_API_TOKEN` | Token Cloudflare API (optional) |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID (optional) |
| `CLOUDFLARE_LB_POOL_ID` | Load Balancer Pool ID (optional) |

### Flow

```
Cron mỗi 5 phút → FailoverService.monitorAndFailover()
    │
    ▼
┌─────────────────────────────────────────────┐
│  runHealthChecks()                           │
│  └─ status: healthy | degraded | unhealthy  │
└──────────────┬──────────────────────────────┘
               │
      ┌────────┼────────────┐
      ▼        ▼            ▼
   healthy   degraded    unhealthy
      │        │            │
      │   PostHog log   PostHog alert
      │        │            │
      │        │       triggerCloudflareFailover()
      │        │            │
      │        │       Nếu có Cloudflare API:
      │        │       → PATCH LB pool: disabled
      │        │       → Traffic về secondary region
      │        │
      │        │       Nếu không có API:
      │        │       → Log secondary region URL
      │        │
      ◄────────┴────────────┘
```

### Cloudflare API Integration

FailoverService có thể toggle Cloudflare Load Balancer pool thật:

```typescript
const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/load_balancers/pools/${poolId}/health`,
  {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ enabled: false }),
  }
);
```

Nếu không cấu hình Cloudflare, chỉ log secondary region URL.

---

## 3. QStash Cron Jobs

### Job Routes (`src/routes/job.routes.ts`)

| Endpoint | Cron | Handler | Description |
|----------|------|---------|-------------|
| `POST /api/jobs/welcome-email` | On event | `JobController.handleWelcomeEmail` | Gửi email chào mừng |
| `POST /api/jobs/daily-cleanup` | 0 0 * * * | `JobController.handleDailyCleanup` | Dọn dẹp daily |
| `POST /api/jobs/self-heal` | 0 * * * * | `JobController.handleSelfHeal` | Self-healing hàng giờ |
| `POST /api/jobs/failover-check` | */5 * * * * | `JobController.handleFailoverCheck` | Kiểm tra failover mỗi 5 phút |

### Cron Schedule Registration (`src/server.ts`)

Cron jobs được đăng ký tự động khi server khởi động:

```typescript
async function registerCronJobs() {
  await QStashService.createSchedule('/api/jobs/self-heal', '0 * * * *');
  await QStashService.createSchedule('/api/jobs/failover-check', '*/5 * * * *');
  await QStashService.createSchedule('/api/jobs/daily-cleanup', '0 0 * * *');
}
```

QStash sẽ ignore nếu schedule đã tồn tại (idempotent).

### Idempotency

Tất cả jobs đều xác thực qua `qstashMiddleware`:
1. Upstash signature verification (HMAC-SHA256)
2. Idempotency check: `redis.get('qstash:processed:{messageId}')` — nếu có → skip
3. Sau khi xử lý thành công → set key TTL 24h

---

## 4. Health Check Endpoints

| Endpoint | Response | Frequency |
|----------|----------|-----------|
| `GET /` | Welcome + system status | - |
| `GET /health` | `{ status, checks: { database, redis } }` | Monitoring scrapers |
| `GET /ping` | `200 OK` hoặc `503 warming_up` | Load balancer |
| `GET /metrics` | Prometheus metrics (`prom-client`) | Prometheus scrape |

### Health Response Examples

```json
{
  "status": "healthy",
  "timestamp": "2026-05-27T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 12345,
  "checks": {
    "database": { "status": "up", "latencyMs": 5 },
    "redis": { "status": "up", "latencyMs": 2 }
  }
}
```

---

## 5. MongoDB Connection Config

```typescript
await mongoose.connect(mongoUri, {
  maxPoolSize: 50,           // Tối đa 50 connections
  minPoolSize: 5,            // Giữ tối thiểu 5
  serverSelectionTimeoutMS: 15000,  // 15s timeout
  socketTimeoutMS: 45000,          // 45s socket timeout
  heartbeatFrequencyMS: 10000,      // Health check mỗi 10s
});
```

---

## 6. Monitoring Stack

| Tool | Config | Purpose |
|------|--------|---------|
| Sentry | `SENTRY_DSN` | Error tracking (production only) |
| PostHog | `POSTHOG_KEY` | Self-healing/failover events |
| Pino | `LOG_LEVEL` | JSON structured logging |
| Prometheus | `GET /metrics` | CPU, RAM, Event Loop, HTTP counters |
