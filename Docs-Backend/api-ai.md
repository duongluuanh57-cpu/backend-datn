# AI Endpoints

## Generate

```http
POST /api/ai/generate
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "prompt": "Write a description for a rose perfume", "type": "description" }
```

Response `200` — `{ "result": "generated text..." }`

## Generate Product

```http
POST /api/ai/generate-product
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "name": "Rose Gold", "category": "Eau de Parfum", "brand": "Chanel" }
```

Response `200` — `{ "description": "...", "metaTitle": "...", "metaDescription": "..." }`

## Generate Brand

```http
POST /api/ai/generate-brand
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "name": "Chanel", "origin": "France" }
```

Response `200` — `{ "description": "..." }`

## Agent Run

```http
POST /api/ai/agent/run
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "task": "Analyze sales data for last month" }
```

Response `200` — `{ "result": "...", "actions": [] }`

## Support Chat

```http
POST /api/ai/support/chat
Content-Type: application/json

{ "message": "Where is my order?", "conversationId": "uuid" }
```

Response `200` — `{ "reply": "...", "conversationId": "uuid" }`

## Chat (SSE Stream)

```http
POST /api/ai/chat
Content-Type: application/json

{ "message": "Recommend a summer perfume", "history": [] }
```

Response `200` — SSE stream of token chunks.

## Admin Chat (SSE Stream)

```http
POST /api/ai/admin/chat
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "message": "Generate monthly report", "history": [] }
```

Response `200` — SSE stream.

## Autocomplete

```http
POST /api/ai/autocomplete
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "text": "Eau de", "field": "productName" }
```

Response `200` — `{ "suggestions": ["Eau de Parfum", "Eau de Toilette"] }`

## Suggest Price

```http
POST /api/ai/suggest-price
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "name": "Rose Gold", "category": "Eau de Parfum", "brand": "Chanel" }
```

Response `200` — `{ "suggestedPrice": 650000, "minPrice": 500000, "maxPrice": 800000, "confidence": 0.85 }`

## Feedback

```http
POST /api/ai/feedback
Content-Type: application/json

{ "message": "Great recommendations!", "rating": 5 }
```

Response `200` — `{ "message": "Feedback recorded" }`

## Scan Gallery Image (Vision)

```http
POST /api/ai/scan-gallery-image
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "imageUrl": "https://example.com/perfume.jpg" }
```

Response `200` — `{ "labels": ["perfume", "bottle", "Chanel"], "description": "..." }`

## Health

```http
GET /api/ai/health
```

Response `200` — `{ "status": "ok", "model": "gpt-4o", "latency": 120 }`
