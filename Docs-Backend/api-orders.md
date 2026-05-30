# Orders

All endpoints require authentication.

## My Orders

```http
GET /api/orders/my-orders?page=1&limit=10&status=pending|confirmed|shipped|delivered|cancelled
Authorization: Bearer <token>
```

Response `200`:
```json
{ "data": [{ "id": "uuid", "orderCode": "ORD-001", "status": "pending", "total": 590000, "items": [], "shippingAddress": {}, "payment": {}, "createdAt": "iso" }], "pagination": { "page": 1, "limit": 10, "total": 5, "totalPages": 1 } }
```

## Get Order

```http
GET /api/orders/:id
Authorization: Bearer <token>
```

Response `200` — full order with items, address, payment.

## Admin — List All Orders

```http
GET /api/orders/admin/orders?page=1&limit=20&status=&search=
Authorization: Bearer <admin-token>
```

Response `200` — paginated orders (all users).

## Admin — Get Order

```http
GET /api/orders/admin/:id
Authorization: Bearer <admin-token>
```

Response `200` — full order details.

## Admin — Update Status

```http
PATCH /api/orders/admin/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "status": "shipped" }
```

Response `200` — `{ "message": "Order status updated", "order": {} }`

## Admin — Update Payment Status

```http
PATCH /api/orders/admin/:id/payment-status
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "paymentStatus": "paid" }
```

Response `200` — `{ "message": "Payment status updated" }`

## Admin — Delete Order

```http
DELETE /api/orders/admin/:id
Authorization: Bearer <admin-token>
```

Response `200` — `{ "message": "Order deleted" }`
