# Products

## List Products

```http
GET /api/products?page=1&limit=20&search=perfume&categoryId=uuid&brandId=uuid&sortBy=price&sortOrder=asc
```

Response `200`:
```json
{ "data": [{ "id": "uuid", "name": "Rose Gold", "slug": "rose-gold", "brand": {}, "category": {}, "images": [], "price": 590000, "comparePrice": null, "stock": 10, "isActive": true }], "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```

## Public Products (filtered sections)

```http
GET /api/products/public?section=featured|new-arrivals|best-sellers|sale
```

Response `200` — same shape, filtered by section rules.

## Bulk Fetch

```http
GET /api/products/bulk?ids=uuid1,uuid2,uuid3
```

Response `200` — `{ "data": [...] }`

## Autocomplete

```http
GET /api/products/suggest?q=ros&limit=5
```

Response `200` — `{ "suggestions": ["Rose Gold", "Rose Oud", "Rosemary"] }`

## Get Product

```http
GET /api/products/:id
```

Response `200` — single product object with full relations.

## Create Product (Admin)

```http
POST /api/products
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "name": "New Perfume", "slug": "new-perfume", "description": "...", "brandId": "uuid", "categoryId": "uuid", "price": 350000, "images": ["url1"], "stock": 50, "isActive": true }
```

Response `201` — created product.

## Update Product (Admin)

```http
PATCH /api/products/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "price": 390000, "stock": 45 }
```

Response `200` — updated product.

## Delete Product (Admin)

```http
DELETE /api/products/:id
Authorization: Bearer <admin-token>
```

Response `200` — `{ "message": "Product deleted" }`

## Bulk Delete (Admin)

```http
POST /api/products/bulk-delete
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "ids": ["uuid1", "uuid2"] }
```

Response `200` — `{ "message": "2 products deleted" }`
