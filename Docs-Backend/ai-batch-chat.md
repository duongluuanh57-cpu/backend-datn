# User Chat Flow (BatchBuffer)

## Endpoint
`POST /api/ai/chat`

## Flow Steps

1. **Receive user message**
2. **Adaptive Learning** — fetch user rating history to personalize tone
3. **Hybrid Search** via `SearchService` (MongoDB aggregate pipeline: keyword `$regex` + brand lookup + vector cosine similarity on `ProductSEO.embedding`)
4. **BatchBuffer** — batch multiple user questions into a single Gemini call:
   - **Window**: 150ms
   - **Max users**: 15 per batch
   - **Max wait**: 2s
5. **Gemini call** — 1 request for N questions
6. **Parse JSON response** — map back to individual users
7. **Cache results**:
   - **Redis** — permanent cache (TTL managed)
   - **Knowledge DB** — persistent store

## Feedback System

After each answer, users can rate 1–5:
- **1–2** → log negative feedback, retry with more context
- **3** → neutral, no action
- **4–5** → reinforce in Adaptive Learning profile
