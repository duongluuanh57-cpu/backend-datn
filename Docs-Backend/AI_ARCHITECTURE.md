# AI Architecture — Elite SaaS Backend

## Tổng quan

Hệ thống AI được xây dựng với **Google Gemini 3.1 Flash-Lite** làm core model, kết hợp **LangGraph** cho multi-agent workflows, **Gemini Embedding 2** cho semantic search, và **LLM-as-a-Judge** cho quality evaluation.

```
┌──────────────────────────────────────────────────────────────┐
│                     AI SYSTEM OVERVIEW                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌────────────┐              │
│  │  Gemini  │   │ LangGraph│   │  Hybrid    │              │
│  │ 3.1 Flash│   │  Agent   │   │  Search    │              │
│  │  + Vision│   │ Workflow │   │(Key+Vector)│              │
│  └────┬─────┘   └────┬─────┘   └─────┬──────┘              │
│       │              │               │                      │
│       ▼              ▼               ▼                      │
│  ┌──────────────────────────────────────────┐               │
│  │           AI Service Layer                │               │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │               │
│  │  │ AIService │ │AgentSrvc│ │SearchSrvc│  │               │
│  │  │cascade +  │ │LangGraph│ │ hybrid + │  │               │
│  │  │  retry    │ │3 Agents │ │ greeting │  │               │
│  │  └──────────┘ └──────────┘ └──────────┘  │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │          Support Services                 │               │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │               │
│  │  │EvalService│ │RedisSrvc│ │ImageSrvc │  │               │
│  │  │LLM-as-a- │ │ AI Cache│ │Sharp+ R2│  │               │
│  │  │  Judge   │ │permanent│ │optimize  │  │               │
│  │  └──────────┘ └──────────┘ └──────────┘  │               │
│  └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Core AI Service (`AIService.ts`)

### Cascade Fallback Pattern

AI Service triển khai **cascade fallback với retry** để đảm bảo độ tin cậy:

```
User Request
    │
    ▼
┌─────────────────────────────────────────────┐
│  Attempt 1: Model 1 (gemini-3.1-flash-lite) │──→ Success → Return
│                    Lỗi?                      │
└─────────────────────┬───────────────────────┘
                      │ Lỗi (503/429/timeout)
                      ▼
┌─────────────────────────────────────────────┐
│  Attempt 2: Model 2 (gemini-3.1-flash-lite) │──→ Success → Return
│                    Lỗi?                      │
└─────────────────────┬───────────────────────┘
                      │ Lỗi
                      ▼
┌─────────────────────────────────────────────┐
│  Attempt 3: Model 3 (gemini-3.1-flash-lite) │──→ Success → Return
│                    Lỗi?                      │
└─────────────────────┬───────────────────────┘
                      │ Hết 3 models
                      ▼
              ┌─────────────────┐
              │  Retry cycle 2   │──→ Lặp lại từ Model 1
              │  (3 models × 3   │
              │   cycles = 9     │
              │   attempts max)  │
              └─────────────────┘
```

**Key features:**
- **Exponential backoff**: Tăng dần thời gian chờ giữa các retry attempts
- **Error handling**: Xử lý HTTP 503 (Service Unavailable) và 429 (Rate Limited)
- **Safety settings**: `BLOCK_NONE` — không chặn nội dung (cần cho phân tích sản phẩm)
- **3 model names đồng nhất**: `'gemini-3.1-flash-lite'` cho cả primary, fallback 1, fallback 2 (dự phòng cho model overload)

### Methods

| Method | Type | Description |
|--------|------|-------------|
| `identifyProduct(imageBuffer)` | Vision | Phân tích ảnh sản phẩm, trả về features |
| `createChatStream(messages, req, clientInfo)` | Streaming | Chat với streaming response |
| `generateResponse(prompt, role, modelName?)` | Non-streaming | Text generation |
| `generateEmbedding(text)` | Embedding | Vector embedding (3072 dims) |

---

## 2. LangGraph Multi-Agent (`AgentService.ts`)

Triển khai **StateGraph** với 3 agents nối tiếp:

```
START
  │
  ▼
┌─────────────────────────────────────────────┐
│  Agent 1: RESEARCHER                         │
│  "Bạn là người nghiên cứu thông thái..."     │
│  → Tóm tắt chủ đề bằng ngôn ngữ bình dân     │
└───────────────────┬─────────────────────────┘
                    │ research output
                    ▼
┌─────────────────────────────────────────────┐
│  Agent 2: WRITER                             │
│  "Bạn là người kể chuyện tài ba..."          │
│  → Viết bài dựa trên research, tối giản      │
└───────────────────┬─────────────────────────┘
                    │ final_output (draft)
                    ▼
┌─────────────────────────────────────────────┐
│  Agent 3: REVIEWER                           │
│  "Bạn là biên tập viên..."                   │
│  → Kiểm duyệt, loại bỏ từ phức tạp          │
└───────────────────┬─────────────────────────┘
                    │ reviewed output
                    ▼
                   END
```

**Caching**: Toàn bộ workflow được cache trong Redis 24h (SHA256 hash của task).
**Model**: Cả 3 agents đều dùng Gemini 3.1 Flash-Lite.

---

## 3. Hybrid Search (`SearchService.ts`)

Kết hợp **keyword matching** và **semantic search**:

```
User Query: "nước hoa nam hương gỗ"
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. Greeting Detection                       │
│  ├─ "chào", "hello", "xin chào"...          │
│  └─ → mode: 'greeting' (skip search)        │
└───────────────────┬─────────────────────────┘
                    │ Not greeting
                    ▼
┌─────────────────────────────────────────────┐
│  2. Keyword Search                           │
│  ├─ Filter products by name matching        │
│  ├─ Filter by brand name                    │
│  └─ Filter by keywords (tags)               │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  3. Mode Classification                      │
│  ├─ 'specific': có kết quả chính xác        │
│  ├─ 'general': có kết quả gần đúng          │
│  └─ 'greeting': chào hỏi, không search      │
└───────────────────┬─────────────────────────┘
                    │ { products, mode, brands }
                    ▼
             Return to Controller
```

**Debug**: Ghi log vào `search_debug.log` để phân tích quality.

---

## 4. RAG Pipeline (Retrieval-Augmented Generation)

```
User Question
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. Context Building                         │
│  ├─ Global DB info: brands, tags,           │
│  │   scent groups, concentrations, segments  │
│  ├─ Product search results                   │
│  └─ Knowledge base chunks                    │
└───────────────────┬─────────────────────────┘
                    │ context
                    ▼
┌─────────────────────────────────────────────┐
│  2. System Prompt Generation                 │
│  ├─ Role: "Chuyên gia tư vấn nước hoa..."   │
│  ├─ Context: products + DB info             │
│  ├─ Adaptive directive (từ rating history)  │
│  └─ Constraints: JSON response, tone, etc.  │
└───────────────────┬─────────────────────────┘
                    │ system prompt + user query
                    ▼
┌─────────────────────────────────────────────┐
│  3. Gemini AI Call                           │
│  ├─ Cascade fallback (3 models × 3 retries) │
│  ├─ Safety: BLOCK_NONE                      │
│  └─ Format: streaming text                   │
└───────────────────┬─────────────────────────┘
                    │ response
                    ▼
┌─────────────────────────────────────────────┐
│  4. Post-processing                          │
│  ├─ Lưu vào Redis cache (permanent)         │
│  ├─ Lưu vào Knowledge DB                     │
│  └─ Stream về client (Vercel AI SDK)         │
└─────────────────────────────────────────────┘
```

### Adaptive Learning (trong `AIChatController`)

Hệ thống tự điều chỉnh dựa trên rating lịch sử:

```
5 ratings gần nhất:
  - 4.5★ trở lên → Giữ nguyên system prompt
  - 3-4★ → Thêm directive "chi tiết hơn về mùi hương"
  - Dưới 3★ → Switch sang "ngôn ngữ đơn giản, tập trung vào cảm xúc"

Consecutive low ratings (3 lần ≤ 2★):
  → Thêm "XIN LỖI, hãy hỏi lại câu hỏi cụ thể hơn"
```

---

## 5. Support Chat Orchestration (`SupportService.ts`)

Kết hợp RAG + Multi-agent + Eval trong 1 flow:

```
User Question
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. Hybrid Search (SearchService)            │
│  → { products, context }                     │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  2. LangGraph Workflow (AgentService)        │
│  → Research → Write → Review                │
│  → Response text                            │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  3. Eval (EvalService — LLM-as-a-Judge)     │
│  → Score 1-5, reason                        │
│  → isReliable: score >= 4                   │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
             Return { response, metadata }
```

---

## 6. LLM-as-a-Judge (`EvalService.ts`)

Đánh giá chất lượng phản hồi AI dựa trên **Faithfulness**:

```
Prompt template:
  BẠN LÀ CHUYÊN GIA KIỂM ĐỊNH CHẤT LƯỢNG AI.
  KIẾN THỨC: {context}
  CÂU HỎI: {query}
  CÂU TRẢ LỜI: {answer}
  
  HÃY TRẢ VỀ JSON:
  { "score": 1-5, "reason": "..." }
```

- **Score 5**: Hoàn hảo — trả lời chính xác dựa trên context
- **Score 1**: Hallucination — trả lời không dựa trên context
- Dùng Gemini 3.1 Flash-Lite làm Judge model

---

## 7. Auto-Ingestion (Product `post('save')` hook)

```typescript
ProductSchema.post('save', async function() {
  // Tự động tạo embedding khi lưu sản phẩm
  const text = `${this.name} ${brandName} ${this.description}`;
  const vector = await AIService.generateEmbedding(text);
  
  // Lưu vào ProductSEO
  await ProductSEO.findOneAndUpdate(
    { productId: this._id },
    { $set: { embedding: vector } },
    { upsert: true }
  );
});
```

Mỗi khi Product được tạo/cập nhật, hệ thống tự động:
1. Populate brand name
2. Tạo vector embedding (3072 dimensions)
3. Lưu vào ProductSEO collection

---

## 8. AI Endpoints

| Endpoint | Controller | Description |
|----------|------------|-------------|
| `POST /api/ai/generate` | AICoreController | Non-streaming text generation |
| `POST /api/ai/chat` | AIChatController | Streaming chat + RAG + adaptive |
| `POST /api/ai/support/chat` | AIChatController | Multi-agent + Eval |
| `POST /api/ai/feedback` | AIChatController | Rating-based adaptive response |
| `POST /api/ai/agent/run` | AICoreController | LangGraph workflow |
| `POST /api/ai/generate-product` | AICatalogController | Auto product description |
| `POST /api/ai/generate-brand` | AICatalogController | Auto brand story |
| `POST /api/ai/autocomplete` | AICatalogController | Real-time suggestions |
| `POST /api/ai/suggest-price` | AICatalogController | Market price suggestions |
| `POST /api/ai/scan-gallery-image` | AIVisionController | Image analysis + bilingual captions |

---

## 9. AI Caching Strategy

| Cache | Key Pattern | TTL | Purpose |
|-------|-------------|-----|---------|
| Chat responses | `chat_cache:{base64(query)}` | Vĩnh viễn | Không gọi AI cho câu hỏi trùng |
| Agent workflows | `agent_workflow_cache:{sha256(task)}` | 24h | Cache toàn bộ LangGraph flow |
| AI embeddings | `embedding:{sha256(text)}` | - | Trong ProductSEO (DB) |
| Health checks | - | - | No cache (real-time) |

---

## 10. Environment Variables cho AI

```bash
# Bắt buộc
GEMINI_API_KEY=AIzaSyD...your_key

# Optional (có fallback mặc định)
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
```
