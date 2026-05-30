# Homepage, Knowledge, Content, Audit & Media

## Homepage Config (`homepage_configs`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `tenantId` | String | single doc per tenant |
| `sections` | [Object] | array of section configs |
| `sections[].id` | String | |
| `sections[].enabled` | Boolean | |
| `sections[].order` | Number | |
| `bannerTitleVi` | String | |
| `bannerTitleEn` | String | |
| `bannerSubtitleVi` | String | |
| `bannerSubtitleEn` | String | |
| `bannerLabelVi` | String | |
| `bannerLabelEn` | String | |
| `bannerImages` | [String] | URLs |
| `galleryVi` | [Object] | `{url, aspect, title, quote}` |
| `galleryEn` | [Object] | same shape |
| `productCardConfig` | Object | styling fields |

## Knowledge (`knowledge`)

| Field | Type | Notes |
|-------|------|-------|
| `question` | String | used for AI RAG |
| `answer` | String | |
| `tenantId` | String | |

**Indexes:** `{ question: 'text' }`, `{ tenantId: 1 }`

## Content (`contents`)

| Field | Type | Notes |
|-------|------|-------|
| `title` | String | |
| `slug` | String | unique |
| `content` | String | HTML / Markdown |
| `type` | String | `blog` / `page` / `faq` |
| `status` | String | `published` / `draft` |
| `tags` | [String] | |
| `tenantId` | String | |

**Indexes:** `{ slug: 1 }` (unique), `{ type: 1, status: 1 }`

## Audit Logs (`audit_logs`)

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | ref `users` |
| `action` | String | e.g. `create`, `update`, `delete` |
| `resource` | String | target collection |
| `metadata` | Mixed | request context |
| `status` | String | `success` / `failure` |

**Indexes:** `{ userId: 1 }`, `{ action: 1, createdAt: -1 }`

## Media (`media`)

| Field | Type |
|-------|------|
| `url` | String |
| `displayUrl` | String |
| `originalBytes` | Number |
| `compressedBytes` | Number |
| `filename` | String |
