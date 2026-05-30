# Dashboard Stats

```http
GET /api/stats/dashboard?range=7d|30d|90d|1y
Authorization: Bearer <admin-token>
```

Response `200`:
```json
{ "revenue": { "total": 12500000, "trend": 12.5 }, "orders": { "total": 42, "pending": 3, "shipped": 8, "delivered": 28 }, "visits": { "total": 1520, "dailyAvg": 217 }, "topProducts": [], "revenueChart": [{ "date": "2026-05-01", "value": 2500000 }] }
```

## Track Visit

```http
POST /api/stats/track-visit
Content-Type: application/json

{ "page": "/products/rose-gold", "referrer": "google" }
```

Response `200` — `{ "message": "Visit tracked" }`

---

# Payments

All payment endpoints require admin auth unless noted.

## List Payments

```http
GET /api/payments?page=1&limit=20&status=pending|paid|failed|refunded
Authorization: Bearer <admin-token>
```

Response `200`:
```json
{ "data": [{ "id": "uuid", "orderId": "uuid", "orderCode": "ORD-001", "method": "cod|bank_transfer|momo", "amount": 590000, "status": "paid", "paidAt": "iso" }], "pagination": {} }
```

## Get Payment

```http
GET /api/payments/:id
Authorization: Bearer <admin-token>
```

## Get Payment by Order

```http
GET /api/payments/order/:orderId
Authorization: Bearer <admin-token>
```

## Create Payment

```http
POST /api/payments
Authorization: Bearer <token>
Content-Type: application/json

{ "orderId": "uuid", "method": "bank_transfer", "amount": 590000 }
```

Response `201` — created payment.

## Update Payment Status (Admin)

```http
PATCH /api/payments/:id/paid
PATCH /api/payments/:id/failed
PATCH /api/payments/:id/refunded
Authorization: Bearer <admin-token>
```

Each returns `200` — `{ "message": "Payment marked as ..." }`

## Delete Payment (Admin)

```http
DELETE /api/payments/:id
Authorization: Bearer <admin-token>
```

Response `200` — `{ "message": "Payment deleted" }`
