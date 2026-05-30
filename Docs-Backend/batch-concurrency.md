# Batch & Concurrency

## ConcurrencyLimiter
- Global singleton, guards all Gemini API calls
- `maxConcurrent`: 10, `maxQueueSize`: 200
- Priority queue (higher priority → FCFS)
- Usage:
  ```ts
  const release = await geminiLimiter.acquire(priority);
  try { /* Gemini call */ } finally { release(); }
  ```

## BatchBufferService
Gom nhiều chat requests vào 1 lần gọi Gemini.

| Parameter | Value |
|-----------|-------|
| `BATCH_WINDOW_MS` | 150ms |
| `MAX_BATCH_SIZE` | 15 users |
| `MAX_WAIT_MS` | 2000ms |
| `RETRY_COUNT` | 1 |

**Flow:** Push request → timer (150ms) or max users (15) → flush → cache check → batch Gemini call → resolve all.

## Gemini Rate Limiting
- Max 10 concurrent calls (ConcurrencyLimiter)
- Batch streams: 1 call for up to 15 users (9x throughput)
- Cascade retry: 3 models × 3 attempts = 9 max

## Excluded from Batch
- `/api/ai/admin/chat` (streaming + function calling)
- `/api/ai/generate-product`, `/api/ai/generate-brand` (unique long prompts)
- `/api/ai/scan-gallery-image` (vision)
- `/api/ai/autocomplete` (cache + concurrency limiter sufficient)
