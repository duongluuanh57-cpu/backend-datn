# Embedding & AI Pipeline

## Auto-Ingestion
- `ProductSchema.post('save')` hook triggers embedding generation
- `AIService.generateEmbedding(productDescription)` returns **3072-dim vector**
- Vector stored in `ProductSEO.embedding`

## Hybrid Search Pipeline
```
User Query
    ↓
  Keyword $regex match (nameVi, nameEn)
    ↓
  Brand lookup (brandId → brand name)
    ↓
  Vector similarity search (cosine)
    ↓
  Merge & rank results
```

## Vector Search
- **Field**: `ProductSEO.embedding`
- **Metric**: cosine similarity
- **Index type**: `vectorSearch` (MongoDB Atlas Search)

## LangGraph Multi-Agent (Admin Q&A)

```
Researcher ──→ Writer ──→ Reviewer
```

| Agent | Role |
|-------|------|
| **Researcher** | Gathers context from docs + DB |
| **Writer** | Generates answer from research |
| **Reviewer** | Validates quality, caches result |

- **Cache TTL**: 24 hours for reviewed answers
- Used in admin chat for complex analytical questions
