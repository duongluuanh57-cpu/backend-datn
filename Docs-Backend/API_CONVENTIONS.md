# API Conventions — Elite SaaS Backend

## Base URL

```
Development: http://localhost:4000/api
Production:  https://api.yourdomain.com/api
```

## API Versioning

Hiện tại dùng implicit v1 (không version trong URL). Khi có breaking changes mới thêm `/api/v2/`.

---

## HTTP Methods

| Method | Usage | Idempotent |
|--------|-------|------------|
| GET | Retrieve resources | ✅ |
| POST | Create resource / action | ❌ |
| PUT | Replace entire resource | ✅ |
| PATCH | Update partial resource | ❌ |
| DELETE | Remove resource | ✅ |

---

## Request Format

### Headers

```http
Authorization: Bearer <jwt_token>     # Required for protected routes
Content-Type: application/json         # Default
```

**Optional:**
```http
Accept-Language: en-US
X-Request-ID: <uuid>
```

### Query Parameters

```
Pagination:   ?page=1&limit=20
Filtering:    ?brandId=xxx&status=active
Sorting:      ?sort=-createdAt (desc) | ?sort=price (asc)
Search:       ?search=perfume
Fields:       ?fields=name,price,images
```

### Request Body

**JSON** (default):
```json
{ "name": "Product", "price": 100 }
```

**Multipart form-data** (file upload):
```
Content-Type: multipart/form-data
file: <binary>
folder?: "products" | "brands" | "avatars"
```

### Rate Limiting Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1621234567
```

---

## Response Format

### Success — Single Resource
```json
{ "success": true, "data": { "id": "...", "name": "..." } }
```

### Success — List with Pagination
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1, "limit": 20, "total": 150,
    "totalPages": 8, "hasNext": true, "hasPrev": false
  }
}
```

### Success — 204 No Content
For DELETE operations without response body.

### Error
```json
{
  "success": false,
  "message": "Error description"
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 207 | Multi-Status (degraded health) |
| 400 | Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden (wrong role) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 429 | Rate Limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Authentication

JWT-based với 2 token types:

| Token | TTL | Purpose |
|-------|-----|---------|
| Access Token | 15 min (USER) / 7d (rememberMe) / 365d (ADMIN) | API authentication |
| Refresh Token | 7 days | Get new access token |

**Flow:**
```
1. POST /api/auth/login → { accessToken, refreshToken }
2. All API calls → Authorization: Bearer <accessToken>
3. When 401 → POST /api/auth/refresh → { accessToken }
4. POST /api/auth/logout → blacklist refreshToken in Redis
```

**Role-based access (RBAC):**
- `PUBLIC` — No auth required
- `USER` — Auth required, any role
- `ADMIN, SUBADMIN` — Admin-level operations

---

## Multi-tenancy

**Not required in request headers.** Multi-tenancy is handled automatically via the Mongoose plugin, which filters all queries by `tenantId` from the user's JWT claims.

Legacy `X-Tenant-ID` header is still accepted for some routes but not the primary mechanism.

---

## File Upload

- **Max file size:** 12MB (cấu hình trong `@fastify/multipart`)
- **Supported formats:** JPEG, PNG, WebP, GIF
- **Auto-conversion:** WebP (80%+ size reduction)
- **Storage:** Cloudflare R2 (S3-compatible, CDN-enabled)
- **Rate limit:** 20 uploads/min

---

## CORS

```http
Allowed Origins: http://localhost:3000, https://yourdomain.com
Allowed Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Allowed Headers: Content-Type, Authorization, Origin, Accept
```

---

## Best Practices

1. **Use HTTPS** in production
2. **Handle rate limits** with exponential backoff
3. **Use pagination** for list endpoints
4. **Cache responses** client-side when appropriate
5. **Handle 401** by refreshing token automatically
6. **Validate input** client-side before sending
7. **Include meaningful error messages** in response

---

## Complete Endpoint Reference

See [API_REFERENCE.md](./API_REFERENCE.md) for the complete list of all 50+ endpoints with request/response examples.
