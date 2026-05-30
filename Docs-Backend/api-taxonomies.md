# Tags

```http
GET /api/tags?page=1&limit=20&search=
```
Response `200` — `{ "data": [{ "id": "uuid", "name": "Floral", "slug": "floral" }], "pagination": {} }`

```http
GET /api/tags/:id
```
Response `200` — single tag.

```http
POST /api/tags
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "name": "Woody", "slug": "woody" }
```
Response `201` — created tag.

```http
PATCH /api/tags/:id
Authorization: Bearer <admin-token>
```
Response `200` — updated tag.

```http
DELETE /api/tags/:id
Authorization: Bearer <admin-token>
```
Response `200` — `{ "message": "Tag deleted" }`

---

# Categories

Same CRUD pattern as Tags.

```http
GET /api/categories?page=1&limit=20&search=&parentId=
GET /api/categories/:id
POST /api/categories (admin)    — { "name": "Eau de Parfum", "slug": "edp", "parentId": null }
PATCH /api/categories/:id (admin)
DELETE /api/categories/:id (admin)
```

---

# Taxonomies

## v1 — By Type

```http
GET /api/taxonomies?type=segment|scent_group|concentration
```

Response `200` — `{ "data": [{ "id": "uuid", "type": "concentration", "name": "Eau de Parfum", "slug": "edp" }] }`

## v2 — Nested

```http
GET /api/v2/taxonomies
```

Response `200` — nested tree structure grouped by type.

```http
GET /api/v2/taxonomies/terms?taxonomyId=uuid
```

Response `200` — terms for a taxonomy.

```http
POST /api/v2/taxonomies (admin)
PATCH /api/v2/taxonomies/:id (admin)
DELETE /api/v2/taxonomies/:id (admin)
```

---

# Legacy

```http
GET /api/segments
```

Deprecated. Use `GET /api/taxonomies?type=segment` instead.
