# AI Architecture — Elite SaaS Backend

## Tổng quan

Hệ thống AI được xây dựng với **Google Gemini** làm core model (cascade 3 model khác nhau), kết hợp **LangGraph** cho multi-agent workflows, **Gemini Embedding 2** cho semantic search. Chat với users dùng **BatchBuffer** để gom nhiều request vào 1 lần gọi Gemini.

```
┌──────────────────────────────────────────────────────────────┐
│                     AI SYSTEM OVERVIEW                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌────────────┐              │
│  │  Gemini   │   │ LangGraph│   │  Hybrid    │              │
│  │ Cascade   │   │  Agent   │   │  Search    │              │
│  │3 Models   │   │ Workflow │   │(Key+Vector)│              │
│  └────┬─────┘   └────┬─────┘   └─────┬──────┘              │
│       │              │               │                      │
│       ▼              ▼               ▼                      │
│  ┌──────────────────────────────────────────┐               │
│  │           AI Service Layer                │               │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │               │
│  │  │ AIService │ │AgentSvc │ │SearchSvc │  │               │
│  │  │cascade +  │ │LangGraph│ │ hybrid + │  │               │
│  │  │  retry    │ │3 Agents │ │ greeting │  │               │
│  │  └──────────┘ └──────────┘ └──────────┘  │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │       Infrastructure Services             │               │
│  │  ┌──────────┐ ┌──────────────┐          │               │
│  │  │BatchBuf  │ │Concurrency   │          │               │
│  │  │150ms/15  │ │Limiter 10/200│          │               │
│  │  │batch +   │ │Gemini slot   │          │               │
│  │  │cache     │ │guard         │          │               │
│  │  └──────────┘ └──────────────┘          │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │          Support Services                 │               │
│  │  ┌──────────┐ ┌────────────┐             │               │
│  │  │RedisSvc  │ │ AdminTool  │             │               │
│  │  │ AI Cache │ │Fn Calling  │             │               │
│  │  │permanent │ │for Admin   │             │               │
│  │  └──────────┘ └────────────┘             │               │
│  └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

---

## Rate Limiting

| Role | Limit | Time Window |
|------|-------|-------------|
| Guest | 60 | 1 minute |
| USER | 300 | 1 minute |
| SUBADMIN | 2000 | 1 minute |
| ADMIN | 5000 | 1 minute |

---

## 1. Core AI Service (`AIService.ts`)

### Cascade Fallback Pattern — 3 Model Khác Nhau

Khác với tài liệu cũ (3 model giống nhau), cascade hiện tại dùng **3 model khác nhau** để tăng resilience:

| Model | Vai trò | Ghi chú |
|-------|---------|---------|
| `gemini-3.1-flash-lite` | Primary | Model nhanh nhất, mới nhất |
| `gemini-2.0-flash-lite` | Fallback 1 | Nhẹ hơn, vẫn đủ nhanh |
| `gemini-1.5-flash-lite` | Fallback 2 | Fallback cuối, model cũ |

```
User Request
    |
    ▼
+---------------------------------------------+
|  Attempt 1: gemini-3.1-flash-lite (Primary) |--> Success → Return
|                    Lỗi?                      |
+------------------------+--------------------+
                         | Lỗi (503/429/timeout)
                         ▼
+---------------------------------------------+
|  Attempt 2: gemini-2.0-flash-lite           |--> Success → Return
|                    Lỗi?                      |
+------------------------+--------------------+
                         | Lỗi
                         ▼
+---------------------------------------------+
|  Attempt 3: gemini-1.5-flash-lite           |--> Success → Return
|                    Lỗi?                      |
+------------------------+--------------------+
                         | Hết 3 models
                         ▼
                +-----------------+
                |  Retry cycle 2   |--> Lặp lại từ Model 1
                |  (3 models × 3   |
                |   cycles = 9     |
                |   attempts max)  |
                +-----------------+
```

**Key features:**
- **Concurrency Limiter**: Mọi Gemini call đều qua `geminiLimiter.acquire()` — tối đa 10 call đồng thời
- **Exponential backoff**: Tăng dần thời gian chờ giữa các retry attempts
- **Error handling**: Xử lý HTTP 503 (Service Unavailable) và 429 (Rate Limited)
- **Safety settings**: `BLOCK_NONE` — không chặn nội dung

### Methods

| Method | Type | Description |
|--------|------|-------------|
| `identifyProduct(imageBuffer, prompt)` | Vision | Phân tích ảnh sản phẩm, cascade fallback |
| `createChatStream(messages, systemPrompt, image)` | Streaming | Chat streaming (dùng cho admin chat, feedback, vision fallback) |
| `createBatchChatStream(items[])` | Batch | Gọi Gemini 1 lần cho nhiều câu hỏi, parse JSON response |
| `generateResponse(prompt, userId?, modelName?)` | Non-streaming | Text generation, cascade fallback |
| `generateEmbedding(text)` | Embedding | Vector embedding (768 dims). Fallback: SHA-256 hash → deterministic unit vector |
| `healthCheck()` | Health | Test AI service availability |

---

## 2. BatchBufferService (`BatchBufferService.ts`)

**Cơ chế batch** để tối ưu throughput cho chat endpoint.

### Flow

```
User A --+
User B --+
User C --+  +--------------------------------------------+
User D --+  |        BatchBuffer (150ms window)          |
User E --+--+  queue.push()                              |
User F --+  |  • 150ms timeout flush                     |
User G --+  |  • 15 users → force flush                  |
User H --+  |  • 2s max wait                             |
         |  |  • Cache check trước: Redis + Knowledge DB |
         |  +---------------------+----------------------+
                                  | flush()
                                  ▼
         +------------------------------------------------+
         |  AIService.createBatchChatStream(items[])       |
         |  • Build 1 batch prompt với N câu hỏi          |
         |  • Gọi Gemini 1 lần                            |
         |  • Parse JSON response { shortId: answer }     |
         |  • Cache vào Redis + Knowledge DB              |
         +---------------------+--------------------------+
                               |
         +--------------------+--------------------+
         ▼                    ▼                    ▼
      User A ✓            User B ✓             User C ✓
      (resolve)            (resolve)            (resolve)
```

### Config
| Parameter | Value | Description |
|-----------|-------|-------------|
| `BATCH_WINDOW_MS` | 150ms | Chờ tối đa 150ms trước khi flush |
| `MAX_BATCH_SIZE` | 15 | Force flush khi đủ 15 users |
| `MAX_WAIT_MS` | 2000ms | Flush bắt buộc sau 2s |
| `RETRY_COUNT` | 1 | Retry 1 lần nếu Gemini fail |

### Cache Strategy
- **Redis cache**: Key `ai:chat:{tenantId}:{base64(question)}` — permanent
- **Knowledge DB**: Lưu question → answer vào MongoDB cho RAG
- **Cache check trước batch**: Kiểm tra Redis trước, chỉ gửi câu chưa có cache lên Gemini

### Retry Logic
- Retry 1 lần toàn bộ batch nếu Gemini fail
- Nếu vẫn fail → reject tất cả entries với `'AI temporarily unavailable'`

---

## 3. ConcurrencyLimiter (`ConcurrencyLimiter.ts`)

Bảo vệ Gemini API khỏi quá tải khi có nhiều request cùng lúc.

### Config
| Parameter | Value | Description |
|-----------|-------|-------------|
| `maxConcurrent` | 10 | Tối đa 10 Gemini call đồng thời |
| `maxQueueSize` | 200 | Queue tối đa 200 request đang chờ |

### Priority Queue
- `acquire(priority)` — Priority mặc định 0
- Request đầu tiên trong cascade (attempt 1) được ưu tiên hơn (priority=1)
- Queue tự động sort: priority cao → timestamp thấp (FCFS nếu cùng priority)

### Usage
```typescript
const release = await geminiLimiter.acquire(1);
try {
  const result = await model.generateContent(prompt);
  return result;
} finally {
  release();
}
```

---

## 4. LangGraph Multi-Agent (`AgentService.ts`)

Triển khai **StateGraph** với 3 agents nối tiếp:

```
START
  |
  ▼
+---------------------------------------------+
|  Agent 1: RESEARCHER                         |
|  → Tóm tắt chủ đề bằng ngôn ngữ bình dân    |
+--------------------+------------------------+
                     | research output
                     ▼
+---------------------------------------------+
|  Agent 2: WRITER                             |
|  → Viết bài dựa trên research, tối giản     |
+--------------------+------------------------+
                     | final_output (draft)
                     ▼
+---------------------------------------------+
|  Agent 3: REVIEWER                           |
|  → Kiểm duyệt, loại bỏ từ phức tạp         |
+--------------------+------------------------+
                     | reviewed output
                     ▼
                    END
```

**Caching**: Toàn bộ workflow được cache trong Redis 24h (SHA256 hash của task).

---

## 5. Hybrid Search (`SearchService.ts`)

Kết hợp **keyword matching** qua MongoDB **aggregation pipeline** (thay vì load toàn bộ products vào RAM như trước).

```
User Query: "nước hoa nam hương gỗ"
    |
    ▼
+---------------------------------------------+
|  1. Greeting Detection                       |
|  ├─ 16 patterns: chào, hello, cảm ơn, bye...|
|  └─ → mode: 'greeting' (skip search)        |
+--------------------+------------------------+
                     | Not greeting
                     ▼
+---------------------------------------------+
|  2. MongoDB Aggregate Pipeline               |
|  ├─ $lookup brands → brandData              |
|  ├─ $match: $regex trên name + brandData    |
|  ├─ $limit: limit+4 (pre-filter)            |
|  ├─ $sort: soldCount DESC, rating DESC      |
|  └─ $limit: limit (final)                   |
+--------------------+------------------------+
                     | products[]
                     ▼
+---------------------------------------------+
|  3. Post-filter (belt-and-suspenders)        |
|  ├─ Lọc lại name/brand check trong memory   |
|  ├─ 'specific': có kết quả chính xác        |
|  └─ 'general': không có kết quả             |
+--------------------+------------------------+
                     | { products, mode }
                     ▼
              Return to Controller
```

**Thay đổi quan trọng**: Không còn dùng `Product.find({}).toArray()` + filter trong memory. Dùng `mongoose.connection.db.collection('products').aggregate([...])` — MongoDB làm việc filter, sort, limit, join brands. An toàn cho database lớn.

---

## 6. RAG Pipeline (Retrieval-Augmented Generation) — Chat (BATCH)

Chat với users đã chuyển từ **streaming real-time** sang **batch + JSON response**:

```
User sends /api/ai/chat → { messages, image? }
    |
    ▼
AIChatController.chatStream()
    |
    ├─ 1. Image check → image? → fallback direct stream (skip batch)
    |
    ├─ 2. Adaptive Learning (từ rating lịch sử)
    |      └─ avgRating / consecutiveLow → adaptiveDirective
    |
    ├─ 3. Hybrid Search (SearchService)
    |      ├─ products[], mode, context
    |      └─ storeOverview (brands, tags, scent groups...)
    |
    ├─ 4. Push vào BatchBuffer
    |      ├─ question, cacheKey, context
    |      └─ → Promise (resolve/reject)
    |
    └─ 5. BatchBuffer flush → Gemini (1 call N questions)
           ├─ Cache hit? → resolve ngay
           ├─ Gemini success → parse JSON, resolve từng entry
           └─ Gemini fail → retry 1 lần, reject nếu vẫn fail
```

**Response format** (không còn streaming):
```json
{ "response": "Câu trả lời từ AI..." }
```

### Adaptive Learning (trong `AIChatController`)

Hệ thống tự điều chỉnh dựa trên rating lịch sử:

```
5 ratings gần nhất:
  - avgRating >= 4.0 → "Duy trì phong cách hiện tại"
  - avgRating < 4.0 → "Thêm chi tiết cụ thể, cá nhân hóa"
  - avgRating < 3.0 → "Hỏi làm rõ nhu cầu, đề xuất tối đa 2 sản phẩm"
  - consecutiveLow >= 2 → "Hỏi lại nhu cầu, xin lỗi"
```

---

## 7. Admin Chat — Function Calling (`AIChatController.adminChat`)

Admin chat **giữ nguyên streaming** + function calling, không qua batch:

```
Admin sends /api/ai/admin/chat → { message, history }
    |
    ▼
AIChatController.adminChat()
    |
    ├─ 1. DocsService — Fetch GitHub docs (cached 5 phút)
    |      → system prompt với context codebase
    |
    ├─ 2. Gemini call (non-streaming) — function detection
    |      ├─ Tool declarations từ AdminToolService.getDeclarations()
    |      └─ AI decides if it needs DB data
    |
    ├─ 3. Nếu có function call → AdminToolService.execute()
    |      ├─ get_dashboard_stats, list_orders
    |      ├─ list_products, list_brands, list_users
    |      ├─ list_vouchers, list_tags, list_taxonomies
    |      └─ search_products, get_store_overview (user-facing)
    |
    └─ 4. Gemini call (streaming) — final response
           → Stream text về client
```

**DocsService** cung cấp context từ GitHub với topic-based selection:
- Luôn gửi 5 docs mặc định (PROJECT_STRUCTURE, TECH_STACK, API_REFERENCE...)
- Keyword matching để thêm docs liên quan (ví dụ: "order" → thêm DATABASE_SCHEMA)
- Cache 5 phút qua Redis + in-memory

---

## 8. Chat Feedback (`AIChatController.handleFeedback`)

```
User sends /api/ai/feedback → { rating: 1-5 }
    |
    ▼
AIChatController.handleFeedback()
    |
    ├─ Rating 5: "Vui mừng, cảm ơn, hỏi giúp thêm"
    ├─ Rating 4: "Cảm ơn, thừa nhận cần cải thiện"
    ├─ Rating 3: "Hỏi điều chỉnh thêm"
    ├─ Rating 2: "Xin lỗi, đề nghị mô tả lại"
    └─ Rating 1: "Xin lỗi sâu sắc, đề nghị liên hệ hỗ trợ"
    |
    └─ → Stream phản hồi về client (không batch, real-time)
```

---

## 9. Auto-Ingestion (Product `post('save')` hook)

```typescript
// ProductSchema.post('save') — Tự động tạo embedding khi lưu sản phẩm
ProductSchema.post('save', async function() {
  await this.populate(['brandId', 'categories']);
  const brandName = (this.brandId as any)?.name || '';
  const categoryNames = (this.categories as any[] || []).map(c => c?.name).filter(Boolean).join(' ');
  const textToEmbed = `${this.name} ${brandName} ${this.description} ${categoryNames}`;
  const vector = await AIService.generateEmbedding(textToEmbed);
  await ProductSEO.findOneAndUpdate(
    { productId: this._id, tenantId: this.tenantId },
    { $set: { embedding: vector }, $setOnInsert: { slug, metaTitle, ... } },
    { upsert: true, new: true }
  );
});
```

---

## 10. AI Endpoints

| Endpoint | Controller | Response Type | Batch? | Description |
|----------|------------|---------------|--------|-------------|
| `POST /api/ai/generate` | AICoreController | JSON | ❌ | Non-streaming text generation |
| `POST /api/ai/chat` | AIChatController | JSON | ✅ BatchBuffer | Chat với users (có ảnh fallback stream) |
| `POST /api/ai/admin/chat` | AIChatController | Streaming | ❌ | Admin chat + function calling |
| `POST /api/ai/support/chat` | AIChatController | JSON | ✅ BatchBuffer | Alias chatStream |
| `POST /api/ai/feedback` | AIChatController | Streaming | ❌ | Rating-based adaptive response |
| `POST /api/ai/agent/run` | AICoreController | JSON | ❌ | LangGraph workflow |
| `POST /api/ai/generate-product` | AICatalogController | JSON | ❌ | Auto product description |
| `POST /api/ai/generate-brand` | AICatalogController | JSON | ❌ | Auto brand story |
| `POST /api/ai/autocomplete` | AICatalogController | JSON | ❌ | Real-time suggestions (has cache) |
| `POST /api/ai/suggest-price` | AICatalogController | JSON | ❌ | Market price suggestions |
| `POST /api/ai/scan-gallery-image` | AIVisionController | JSON | ❌ | Image analysis + bilingual captions |
| `GET /api/ai/health` | AICoreController | JSON | ❌ | AI health check |

---

## 11. AI Caching Strategy

| Cache | Key Pattern | TTL | Purpose |
|-------|-------------|-----|---------|
| Chat responses | `ai:chat:{tenantId}:{base64(query)}` | Vĩnh viễn | BatchBuffer cache trước khi gọi Gemini |
| Chat cache (old) | `chat_cache:{sha256(query)}` | Vĩnh viễn | Legacy (RedisService) |
| Agent workflows | `agent_workflow_cache:{sha256(task)}` | 24h | Cache toàn bộ LangGraph flow |
| AI autocomplete | `ai_autocomplete_cache:{field}:{base64(val)}` | 7 days | Gợi ý autocomplete |
| AI price cache | `ai_price_cache:{base64(name)}:{markup}:{size}` | 7 days | Giá gợi ý |
| AI embeddings | `embedding:{sha256(text)}` | - | Trong ProductSEO (DB) |
| GitHub docs | `github:doc:{owner}/{repo}/{branch}/{path}` | 5 phút | DocsService cache |
| Health checks | - | - | No cache (real-time) |

---

## 12. Environment Variables cho AI

```bash
# Bắt buộc
GEMINI_API_KEY=AIzaSyD...your_key

# Optional (có fallback mặc định)
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-2