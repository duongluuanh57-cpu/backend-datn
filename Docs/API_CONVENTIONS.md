# API Conventions - Elite SaaS Backend

## Base URL

```
Development: http://localhost:4000/api
Production:  https://api.yourdomain.com/api
```

## API Versioning

Currently using **v1** (implicit, no version in URL for now)

```
/api/auth/login
/api/products
/api/orders
```

Future versioning strategy:
```
/api/v2/products  (when breaking changes needed)
```

## HTTP Methods

| Method | Usage | Idempotent |
|--------|-------|------------|
| GET | Retrieve resources | ✅ Yes |
| POST | Create new resource | ❌ No |
| PUT | Replace entire resource | ✅ Yes |
| PATCH | Update partial resource | ❌ No |
| DELETE | Remove resource | ✅ Yes |

## Request Format

### Headers

**Required for all authenticated requests:**
```http
Authorization: Bearer <jwt_token>
X-Tenant-ID: <tenant_id>
Content-Type: application/json
```

**Optional:**
```http
Accept-Language: en-US
X-Request-ID: <uuid>
```

### Query Parameters

**Pagination:**
```http
GET /api/products?page=1&limit=20
```

**Filtering:**
```http
GET /api/products?category=electronics&status=active
```

**Sorting:**
```http
GET /api/products?sort=-createdAt  (descending)
GET /api/products?sort=price       (ascending)
```

**Search:**
```http
GET /api/products?search=laptop
```

**Field Selection:**
```http
GET /api/products?fields=name,price,image
```

**Full Example:**
```http
GET /api/products?page=1&limit=20&category=electronics&sort=-createdAt&search=laptop&fields=name,price
```

### Request Body

**JSON format (preferred):**
```json
{
  "name": "Product A",
  "price": 100,
  "category": "electronics"
}
```

**Multipart form-data (for file uploads):**
```http
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="name"

Product A
------WebKitFormBoundary
Content-Disposition: form-data; name="image"; filename="product.jpg"
Content-Type: image/jpeg

<binary data>
------WebKitFormBoundary--
```

## Response Format

### Success Response

**Single Resource:**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Product A",
    "price": 100,
    "createdAt": "2026-05-20T10:30:00.000Z"
  }
}
```

**List of Resources (with pagination):**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Product A",
      "price": 100
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "Product B",
      "price": 200
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**No Content (204):**
```http
HTTP/1.1 204 No Content
```

### Error Response

**Standard Error Format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "price",
        "message": "Price must be greater than 0"
      }
    ]
  }
}
```

**Error Codes:**
```json
{
  "VALIDATION_ERROR": "Invalid input data",
  "UNAUTHORIZED": "Authentication required",
  "FORBIDDEN": "Insufficient permissions",
  "NOT_FOUND": "Resource not found",
  "CONFLICT": "Resource already exists",
  "RATE_LIMIT_EXCEEDED": "Too many requests",
  "INTERNAL_ERROR": "Internal server error"
}
```

## HTTP Status Codes

### Success (2xx)
- **200 OK** - Request succeeded
- **201 Created** - Resource created successfully
- **204 No Content** - Request succeeded, no content to return

### Client Errors (4xx)
- **400 Bad Request** - Invalid request data
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource already exists
- **422 Unprocessable Entity** - Validation failed
- **429 Too Many Requests** - Rate limit exceeded

### Server Errors (5xx)
- **500 Internal Server Error** - Unexpected server error
- **503 Service Unavailable** - Service temporarily unavailable

## Authentication

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Multi-tenancy

All requests must include `X-Tenant-ID` header:

```http
GET /api/products
Authorization: Bearer <token>
X-Tenant-ID: tenant_abc123
```

**Tenant Isolation:**
- All queries automatically filtered by `tenantId`
- Users can only access data from their tenant
- Cross-tenant access is forbidden

## Rate Limiting

**Limits:**
- **API endpoints**: 100 requests per 15 minutes
- **Auth endpoints**: 5 requests per 15 minutes
- **AI endpoints**: 10 requests per minute

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1621234567
```

**Rate Limit Exceeded Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 300
  }
}
```

## File Upload

**Single File:**
```http
POST /api/products/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>
X-Tenant-ID: tenant_abc123

------WebKitFormBoundary
Content-Disposition: form-data; name="image"; filename="product.jpg"
Content-Type: image/jpeg

<binary data>
------WebKitFormBoundary--

Response:
{
  "success": true,
  "data": {
    "url": "https://cdn.yourdomain.com/products/abc123.webp",
    "size": 45678,
    "format": "webp",
    "width": 800,
    "height": 600
  }
}
```

**Multiple Files:**
```http
POST /api/products/upload-multiple
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="images"; filename="image1.jpg"
Content-Type: image/jpeg

<binary data>
------WebKitFormBoundary
Content-Disposition: form-data; name="images"; filename="image2.jpg"
Content-Type: image/jpeg

<binary data>
------WebKitFormBoundary--

Response:
{
  "success": true,
  "data": [
    {
      "url": "https://cdn.yourdomain.com/products/abc123.webp",
      "size": 45678
    },
    {
      "url": "https://cdn.yourdomain.com/products/def456.webp",
      "size": 52341
    }
  ]
}
```

**Supported Formats:**
- Images: JPEG, PNG, WebP, GIF
- Max size: 10MB per file
- Auto-conversion to WebP for optimization

## Search & Filtering

### Text Search
```http
GET /api/products?search=laptop
```

### AI Semantic Search
```http
POST /api/ai/search
Content-Type: application/json

{
  "query": "affordable gaming laptop with good graphics",
  "limit": 10
}

Response:
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Gaming Laptop Pro",
      "score": 0.95,
      "relevance": "high"
    }
  ]
}
```

### Advanced Filtering
```http
GET /api/products?filter[price][gte]=100&filter[price][lte]=500&filter[category]=electronics
```

## Webhooks

**Webhook Events:**
- `order.created`
- `order.updated`
- `payment.succeeded`
- `payment.failed`

**Webhook Payload:**
```json
{
  "event": "order.created",
  "timestamp": "2026-05-20T10:30:00.000Z",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "status": "pending",
    "total": 150.00
  }
}
```

**Webhook Signature:**
```http
X-Webhook-Signature: sha256=abc123def456...
```

## CORS

**Allowed Origins:**
```
Development: http://localhost:3000
Production:  https://yourdomain.com
```

**Allowed Methods:**
```
GET, POST, PUT, PATCH, DELETE, OPTIONS
```

**Allowed Headers:**
```
Authorization, Content-Type, X-Tenant-ID, X-Request-ID
```

## API Examples

### Create Product
```http
POST /api/products
Authorization: Bearer <token>
X-Tenant-ID: tenant_abc123
Content-Type: application/json

{
  "name": "Gaming Laptop",
  "description": "High-performance gaming laptop",
  "price": 1299.99,
  "category": "electronics",
  "stock": 50,
  "images": [
    "https://cdn.yourdomain.com/products/laptop1.webp"
  ]
}

Response: 201 Created
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Gaming Laptop",
    "price": 1299.99,
    "createdAt": "2026-05-20T10:30:00.000Z"
  }
}
```

### Get Product
```http
GET /api/products/507f1f77bcf86cd799439011
Authorization: Bearer <token>
X-Tenant-ID: tenant_abc123

Response: 200 OK
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Gaming Laptop",
    "price": 1299.99,
    "stock": 50
  }
}
```

### Update Product
```http
PATCH /api/products/507f1f77bcf86cd799439011
Authorization: Bearer <token>
X-Tenant-ID: tenant_abc123
Content-Type: application/json

{
  "price": 1199.99,
  "stock": 45
}

Response: 200 OK
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "price": 1199.99,
    "stock": 45,
    "updatedAt": "2026-05-20T11:00:00.000Z"
  }
}
```

### Delete Product
```http
DELETE /api/products/507f1f77bcf86cd799439011
Authorization: Bearer <token>
X-Tenant-ID: tenant_abc123

Response: 204 No Content
```

## Best Practices

1. **Always use HTTPS** in production
2. **Include X-Tenant-ID** for all authenticated requests
3. **Handle rate limits** gracefully with exponential backoff
4. **Validate input** on client side before sending
5. **Use pagination** for large datasets
6. **Cache responses** when appropriate
7. **Handle errors** properly with try-catch
8. **Log requests** for debugging
9. **Use idempotency keys** for critical operations
10. **Version your API** when making breaking changes

## Related Documentation

- [Project Structure](./PROJECT_STRUCTURE.md)
- [Tech Stack](./TECH_STACK.md)
- [Coding Standards](./CODING_STANDARDS.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Environment Variables](./ENV_VARIABLES.md)
