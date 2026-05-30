# AI Architecture Overview

## Core Model
- **Provider**: Google Gemini
- **Model**: `gemini-3.1-flash-lite`

## Concurrency Management
- **ConcurrencyLimiter** — max **10 concurrent calls**, queue **200**
- Backpressure via queuing; excess requests rejected

## Safety Configuration
- **BLOCK_NONE** for all safety categories (harm categories, harassment, hate speech, sexual, dangerous content)
- Full control over Gemini safety filters

## Key Methods (`AIService`)

| Method | Description |
|--------|-------------|
| `identifyProduct(userMessage)` | Classify user intent, return matched product IDs |
| `createChatStream(messages)` | Single streaming chat completion |
| `createBatchChatStream(questions, systemPrompt)` | Batch N questions in 1 Gemini call |
| `generateResponse(systemPrompt, userMessage)` | Non-streaming completion |
| `generateEmbedding(content)` | Create 3072-dim vector embedding |
| `healthCheck()` | Verify Gemini API reachability |

## Service Layers
```
Route → AIService → Gemini API
              ↕
     AdminToolService (DB tools)
              ↕
     SearchService (hybrid search)
              ↕
     DocsService (GitHub docs RAG)
              ↕
     AdaptiveLearning (rating history)
```
