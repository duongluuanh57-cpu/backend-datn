# Products & Related Collections

## Products (`products`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `brandId` | ObjectId | ref `brands` |
| `categoryId` | ObjectId | ref `categories` |
| `nameVi` | String | Vietnamese name |
| `nameEn` | String | English name |
| `slug` | String | unique |
| `descriptionVi` | String | |
| `descriptionEn` | String | |
| `basePrice` | Number | |
| `status` | String | `active` / `inactive` / `draft` |
| `tenantId` | String | |

**Indexes:** `{ slug: 1 }` (unique), `{ brandId: 1 }`, `{ categoryId: 1 }`, `{ status: 1, tenantId: 1 }`

## Product Variants (`product_variants`)

| Field | Type | Notes |
|-------|------|-------|
| `productId` | ObjectId | ref `products` |
| `sku` | String | unique |
| `price` | Number | |
| `stock` | Number | |
| `attributes` | Map | color, size, etc. |
| `tenantId` | String | |

**Indexes:** `{ sku: 1 }` (unique), `{ productId: 1 }`

## Product Images (`product_images`)

| Field | Type |
|-------|------|
| `productId` | ObjectId, ref `products` |
| `url` | String |
| `displayUrl` | String |
| `isPrimary` | Boolean |
| `order` | Number |

**Indexes:** `{ productId: 1, order: 1 }`

## Product SEO (`product_seo`)

| Field | Type | Notes |
|-------|------|-------|
| `productId` | ObjectId | ref `products`, unique |
| `metaTitle` | String | |
| `metaDescription` | String | |
| `embedding` | [Number] | 3072-dim vector |

**Indexes:** `{ productId: 1 }` (unique)

## Product Tags (`product_tags`)

| Field | Type |
|-------|------|
| `productId` | ObjectId, ref `products` |
| `tagId` | ObjectId, ref `tags` |

**Indexes:** `{ productId: 1, tagId: 1 }` (compound unique)

## Product Taxonomies (`product_taxonomies`)

| Field | Type |
|-------|------|
| `productId` | ObjectId, ref `products` |
| `taxonomyId` | ObjectId, ref `taxonomies` |

## Product Taxonomy Terms (`product_taxonomy_terms`)

| Field | Type |
|-------|------|
| `productId` | ObjectId, ref `products` |
| `taxonomyTermId` | ObjectId, ref `taxonomy_terms` |

## Auto-Embedding Hook

`ProductSchema.post('save')` calls `AIService.generateEmbedding()` and stores the 3072-dim vector in `ProductSEO.embedding`.
