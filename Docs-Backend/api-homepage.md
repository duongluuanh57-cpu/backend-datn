# Homepage Config

## Get Homepage Config (Public)

```http
GET /api/homepage-config
```

Response `200`:
```json
{
  "heroBanners": [{ "image": "url", "title": "...", "link": "/products/..." }],
  "featuredSections": [{ "title": "Best Sellers", "type": "products", "items": [] }],
  "promoBanners": [{ "image": "url", "link": "/vouchers/..." }],
  "brands": ["uuid1", "uuid2"],
  "seo": { "title": "...", "description": "..." }
}
```

## Update Homepage Config (Admin)

```http
PUT /api/homepage-config
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "heroBanners": [{ "image": "new-url", "title": "Summer Sale", "link": "/products?sale=true" }],
  "featuredSections": [],
  "promoBanners": [],
  "brands": [],
  "seo": { "title": "Home", "description": "Best perfume store" }
}
```

Response `200` — updated config.
