# Brands, Tags & Categories

## Brands (`brands`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | String | required |
| `slug` | String | unique |
| `description` | String | |
| `logo` | String | media URL |
| `status` | String | `active` / `inactive` |
| `tenantId` | String | |

**Indexes:** `{ slug: 1 }` (unique), `{ status: 1, tenantId: 1 }`

## Tags (`tags`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | String | required |
| `slug` | String | unique |
| `tenantId` | String | |

**Indexes:** `{ slug: 1 }` (unique), `{ tenantId: 1 }`

## Categories (`categories`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `nameVi` | String | |
| `nameEn` | String | |
| `slug` | String | unique |
| `parentId` | ObjectId | self-ref for hierarchy |
| `status` | String | `active` / `inactive` |
| `tenantId` | String | |

**Indexes:** `{ slug: 1 }` (unique), `{ parentId: 1 }`, `{ tenantId: 1 }`
