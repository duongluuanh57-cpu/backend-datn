# API Conventions

## Base URL
- Development: `http://localhost:4000/api`
- Production: `https://api.yourdomain.com/api`

## Routing
- All endpoints prefixed with `/api`
- No version in URL yet (implicit v1, `/api/v2/` for breaking changes)

## Authentication
- `Authorization: Bearer <jwt_token>` for protected routes
- Access Token: 15 min (USER) / 7d (rememberMe) / 365d (ADMIN)
- Refresh Token: 7 days
- RBAC: `PUBLIC` (no auth), `USER` (any role), `ADMIN/SUBADMIN` (admin ops)

## Response Format

**Success:**
```json
{ "success": true, "data": { ... } }
{ "success": true, "data": [ ... ], "pagination": { "page", "limit", "total", "totalPages" } }
```

**Error:**
```json
{ "success": false, "message": "Error description" }
```

## HTTP Status Codes
- 200 Success, 201 Created, 204 No Content
- 400 Validation, 401 Unauthorized, 403 Forbidden, 404 Not Found
- 409 Conflict, 429 Rate Limited, 500 Internal Error

## Rate Limiting
- Guest: 60 req/min, User: 300, Admin: 5000

## Pagination & Filtering
```
?page=1&limit=20&sort=-createdAt&search=term&fields=name,price
```
