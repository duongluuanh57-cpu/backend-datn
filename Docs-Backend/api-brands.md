# Brands

## List Brands

```http
GET /api/brands?page=1&limit=20&search=chanel
```

Response `200`:
```json
{ "data": [{ "id": "uuid", "name": "Chanel", "slug": "chanel", "origin": "France", "logo": "url", "description": "...", "productCount": 12 }], "pagination": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 } }
```

## List Origins

```http
GET /api/brands/origins
```

Response `200` — `{ "data": ["France", "Italy", "USA", "UK", "Japan"] }`

## Get Brand

```http
GET /api/brands/:id
```

Response `200` — single brand object with products.

## Create Brand (Admin)

```http
POST /api/brands
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "name": "New Brand", "slug": "new-brand", "origin": "France", "logo": "url", "description": "..." }
```

Response `201` — created brand.

## Update Brand (Admin)

```http
PATCH /api/brands/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "origin": "Italy", "description": "Updated description" }
```

Response `200` — updated brand.

## Delete Brand (Admin)

```http
DELETE /api/brands/:id
Authorization: Bearer <admin-token>
```

Response `200` — `{ "message": "Brand deleted" }`

## Bulk Delete (Admin)

```http
POST /api/brands/bulk-delete
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "ids": ["uuid1", "uuid2"] }
```

Response `200` — `{ "message": "2 brands deleted" }`
