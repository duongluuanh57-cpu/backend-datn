# Taxonomies & Legacy Collections

## Taxonomies (v2) (`taxonomies`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | String | e.g. `scent_group`, `concentration`, `segment` |
| `slug` | String | unique |
| `description` | String | |
| `tenantId` | String | |

**Indexes:** `{ slug: 1 }` (unique), `{ tenantId: 1 }`

Parent types: `scent_group`, `concentration`, `segment`.

## Taxonomy Terms (v2) (`taxonomy_terms`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `taxonomyId` | ObjectId | ref `taxonomies` |
| `nameVi` | String | |
| `nameEn` | String | |
| `slug` | String | unique within taxonomy |
| `tenantId` | String | |

**Indexes:** `{ taxonomyId: 1 }`, `{ slug: 1, taxonomyId: 1 }` (compound unique)

## Legacy Collections

### Segments (`segments`)

| Field | Type |
|-------|------|
| `_id` | ObjectId |
| `name` | String |
| `slug` | String |

### Scent Groups (`scent_groups`)

| Field | Type |
|-------|------|
| `_id` | ObjectId |
| `name` | String |
| `slug` | String |

### Concentrations (`concentrations`)

| Field | Type |
|-------|------|
| `_id` | ObjectId |
| `name` | String |
| `slug` | String |

Legacy collections remain for backward compatibility; new data uses v2 `taxonomies` + `taxonomy_terms`.
