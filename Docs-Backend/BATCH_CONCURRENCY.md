# Batch & Concurrency — Elite SaaS Backend

## 1. ConcurrencyLimiter (`src/services/ConcurrencyLimiter.ts`)

**Mục đích:** Giới hạn số lượng Gemini API call đồng thời, tránh quá tải.

### Config

| Parameter | Value | Description |
|-----------|-------|-------------|
| `maxConcurrent` | 10 | Tối đa 10 Gemini call chạy cùng lúc |
| `maxQueueSize` | 200 | Queue tối đa 200 request đang chờ |

### Cách hoạt động

```
Request đến
    │
    ▼
┌─────────────────────────────────────┐
│  concurrencyLimiter.acquire(priority)│
│                                     │
│  running < maxConcurrent (10)?      │
│  ├─ Yes → running++, trả về release │
│  └─ No  → push vào queue            │
│            (sorted: priority desc,   │
│             timestamp asc)           │
└──────────────┬──────────────────────┘
               │
               ▼
        Gọi Gemini API
               │
               ▼
        release() → running--
               │
               ▼
        Dequeue next request từ queue
```

### Priority Queue

- `acquire(priority)` — priority mặc định 0
- Request đầu trong cascade (attempt 1) dùng priority=1 (ưu tiên hơn)
- Queue tự động sort: **priority cao → timestamp thấp** (FCFS)

### Usage Pattern

```typescript
import { geminiLimiter } from './ConcurrencyLimiter.ts';

// Bọc mọi Gemini call
const release = await geminiLimiter.acquire(1);
try {
  const result = await model.generateContent(prompt);
  return result;
} finally {
  release(); // Luôn gọi release, kể cả khi throw
}
```

### Monitoring

```typescript
geminiLimiter.getStats()
// { active: 3, pending: 5, maxConcurrent: 10, maxQueueSize: 200 }
```

---

## 2. BatchBuffer (`src/services/BatchBufferService.ts`)

**Mục đích:** Gom nhiều chat request từ users vào 1 lần gọi Gemini, tăng throughput 9x.

### Config

| Parameter | Value | Description |
|-----------|-------|-------------|
| `BATCH_WINDOW_MS` | 150ms | Flush sau 150ms kể từ request đầu tiên |
| `MAX_BATCH_SIZE` | 15 | Force flush khi queue đủ 15 users |
| `MAX_WAIT_MS` | 2000ms | Flush bắt buộc sau 2s (tránh request chờ quá lâu) |
| `RETRY_COUNT` | 1 | Retry 1 lần nếu Gemini fail |

### Flow chi tiết

```
1. User gửi POST /api/ai/chat
2. Controller:
   - Check hình ảnh → có ảnh? fallback direct stream
   - Adaptive learning từ rating history
   - Hybrid search → products, context, storeOverview
   - Push vào BatchBuffer: batchBuffer.push({ question, cacheKey, context, ... })
   - Trả về Promise → pending
3. BatchBuffer:
   - Push entry vào queue
   - Schedule flush timer (150ms) + max wait timer (2s)
   - Nếu queue.length >= 15 → flush ngay
4. flush():
   - Clear timers
   - Lấy toàn bộ entries từ queue
   - Check cache (Redis) song song cho tất cả entries
     - Cache hit → resolve() ngay
     - Cache miss → collect vào toProcess[]
5. Nếu toProcess rỗng → done
6. Gọi AIService.createBatchChatStream(toProcess):
   - Build batch prompt với N câu hỏi + context
   - Gọi Gemini 1 lần
   - Parse JSON response { shortId: answer }
7. Với mỗi entry:
   - Cache vào Redis + Knowledge DB (async, fire-and-forget)
   - resolve(answer) → controller send response
8. Nếu Gemini fail → retry 1 lần
   - Vẫn fail → reject() tất cả entries
```

### Batch Prompt Structure

```typescript
const baseInstruction = `Bạn là Tinco - Trợ lý AI bán nước hoa cao cấp.
Lần này bạn nhận NHIỀU câu hỏi từ nhiều khách hàng khác nhau cùng lúc.
Mỗi câu hỏi được đánh dấu bằng [shortId].

QUAN TRỌNG:
- Trả lời TỪNG câu hỏi riêng biệt
- Output là STRICT JSON object, key = shortId, value = câu trả lời
- KHÔNG thêm bất kỳ text nào ngoài JSON`;

const questionsBlock = items.map(item => `
[${item.shortId}]
${item.adaptiveDirective}
DỮ LIỆU:
${item.context}
${item.storeOverview}
CÂU HỎI: "${item.question}"
---`).join('\n');
```

### Cache Strategy

| Cache Layer | Key Pattern | TTL | Purpose |
|-------------|-------------|-----|---------|
| Redis | `ai:chat:{tenantId}:{base64(question)}` | Vĩnh viễn | Tránh gọi Gemini lại cho câu y hệt |
| Knowledge DB | `{ question, answer, tenantId }` | Vĩnh viễn | RAG context cho future queries |

Cache check được thực hiện **trước** khi gọi Gemini, trong quá trình flush.

### Error Handling

```
Gemini call failed (attempt 1)
    │
    ▼
Retry attempt 2
    │
    ├── Success → resolve tất cả
    └── Fail → reject tất cả với:
         "AI temporarily unavailable. Please try again later."
```

---

## 3. Tích hợp với AIService

### `AIService.createBatchChatStream()` — Batch-specific method

```typescript
static async createBatchChatStream(
  items: Array<{
    shortId: string;
    question: string;
    context: string;
    storeOverview: string;
    adaptiveDirective: string;
  }>
): Promise<Map<string, string>> {
  // Build batch prompt
  // Cascade qua 3 models
  // Parse JSON response
  // Return Map<shortId, answer>
}
```

### Concurrency Limiter trong AIService

Tất cả methods trong AIService đều acquire/release qua `geminiLimiter`:

- `createChatStream()` — acquire ngay trước khi gọi API
- `generateResponse()` — acquire/release trong cascade loop
- `createBatchChatStream()` — acquire với priority=1
- `identifyProduct()` — acquire/release trong cascade loop

---

## 4. Ai không nên dùng Batch

| Endpoint | Lý do |
|----------|-------|
| `/api/ai/admin/chat` | Streaming + function calling (tool use) |
| `/api/ai/feedback` | Streaming real-time |
| `/api/ai/generate-product` | Prompt siêu dài (~150 dòng), unique từng request |
| `/api/ai/generate-brand` | Tương tự generate-product |
| `/api/ai/suggest-price` | 2-stage pipeline |
| `/api/ai/scan-gallery-image` | Vision/multimodal |
| `/api/ai/autocomplete` | Cache 7 ngày + concurrency limiter đã đủ |

---

## 5. Performance Impact

| Metric | Trước (streaming) | Sau (batch) |
|--------|-------------------|-------------|
| Gemini calls cho N requests | N | ceil(N/15) |
| Throughput (cùng 1 Gemini key) | ~10 concurrent | Batch 15 users/call |
| Latency thêm | 0 | +150ms (batch window) |
| Response type | Streaming chunks | JSON full text |
| Error rate khi peak | Tăng | Giảm (batch + retry) |
