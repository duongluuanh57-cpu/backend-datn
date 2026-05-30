# Vouchers

## List Vouchers

**Admin** — all vouchers:
```http
GET /api/vouchers?page=1&limit=20
Authorization: Bearer <admin-token>
```

**User** — only active vouchers:
```http
GET /api/vouchers
Authorization: Bearer <token>
```

Response `200`:
```json
{ "data": [{ "id": "uuid", "code": "WELCOME10", "discountType": "percentage|fixed", "discountValue": 10, "minOrder": 0, "maxUses": 100, "usedCount": 5, "expiresAt": "iso", "isActive": true }], "pagination": {} }
```

## Get Voucher

```http
GET /api/vouchers/:id
Authorization: Bearer <token>
```

Response `200` — single voucher.

## Validate Voucher

```http
POST /api/vouchers/validate
Content-Type: application/json

{ "code": "WELCOME10", "orderTotal": 500000 }
```

Response `200`:
```json
{ "valid": true, "discount": 50000, "discountType": "percentage", "discountValue": 10 }
```

## Create Voucher (Admin)

```http
POST /api/vouchers
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "code": "SUMMER20", "discountType": "percentage", "discountValue": 20, "minOrder": 200000, "maxUses": 50, "expiresAt": "2026-12-31T23:59:59Z" }
```

Response `201` — created voucher.

## Update Voucher (Admin)

```http
PATCH /api/vouchers/:id
Authorization: Bearer <admin-token>
```

Response `200` — updated voucher.

## Delete Voucher (Admin)

```http
DELETE /api/vouchers/:id
Authorization: Bearer <admin-token>
```

Response `200` — `{ "message": "Voucher deleted" }`
