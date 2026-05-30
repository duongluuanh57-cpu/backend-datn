# API Reference — Elite SaaS Backend

## Base URL

```
Development: http://localhost:4000
Production:  https://api.yourdomain.com
```

All API routes are prefixed with `/api` (except health/ping/metrics).

---

## Authentication

### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john",
  "email": "john@example.com",
  "password": "SecurePass123"
}

Response: 201
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "...", "username": "john", "email": "john@example.com" }
  }
}
```
**Rate limit:** 10 req/min

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}

Response: 200
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "...", "username": "john", "email": "john@example.com", "role": "USER" }
  }
}
```
**Rate limit:** 10 req/min

### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJ..." }

Response: 200 { "success": true, "data": { "accessToken": "eyJ...", "expiresIn": 900 } }
```

### Logout
```http
POST /api/auth/logout
Content-Type: application/json
Authorization: Bearer <accessToken>

{ "refreshToken": "eyJ..." }

Response: 200 { "success": true, "message": "Logged out successfully" }
```

### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{ "currentPassword": "old", "newPassword": "new123456" }

Response: 200 { "success": true, "message": "Password changed successfully" }
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>

Response: 200 { "success": true, "data": { "id": "...", "username": "john", "email": "..." } }
```

### Update Profile
```http
PATCH /api/auth/update-profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "John Doe",
  "avatar": "https://...",
  "phoneNumber": "0901234567",
  "gender": "MALE"
}

Response: 200 { "success": true, "data": { "user": {...} } }
```
**Optional fields:** username, email, fullName, phoneNumber, gender, address, province, district, avatar

---

## OAuth

### Google Login
```http
GET /api/auth/google
```
Redirects to Google OAuth consent screen.

### Google Callback
```http
GET /api/auth/google/callback?code=4/0AX...
```
Redirects to `FRONTEND_URL` with `accessToken` and `refreshToken` in URL params.

---

## Two-Factor Authentication (2FA)

### Setup 2FA
```http
POST /api/2fa/setup
Content-Type: application/json

{ "email": "user@example.com" }

Response: 200 { "success": true, "data": { "secret": "...", "qrCode": "data:image/png;base64,..." } }
```

### Enable 2FA
```http
POST /api/2fa/enable
Content-Type: application/json

{ "token": "123456", "userId": "..." }

Response: 200 { "success": true, "message": "2FA enabled" }
```

### Verify 2FA
```http
POST /api/2fa/verify
Content-Type: application/json

{ "token": "123456", "userId": "..." }

Response: 200 { "success": true, "message": "2FA verified" }
```

---

## Users (Admin)

All endpoints require `Authorization: Bearer <token>` with `ADMIN` or `SUBADMIN` role.

### List Users
```http
GET /api/users
Authorization: Bearer <token>

Response: 200 { "success": true, "data": [...], "pagination": {...} }
```

### Update User
```http
PATCH /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "suspended", "role": "USER" }
```

### Update User Role
```http
PATCH /api/users/:id/role
Authorization: Bearer <token>
Content-Type: application/json

{ "role": "ADMIN" }
```

### Delete User
```http
DELETE /api/users/:id
Authorization: Bearer <token>
```

---

## User Addresses

All endpoints require `Authorization: Bearer <token>`.

### List Addresses
```http
GET /api/user-addresses
```

### Create Address
```http
POST /api/user-addresses
Content-Type: application/json

{
  "fullName": "John Doe",
  "phone": "0901234567",
  "street": "123 Main St",
  "ward": "Ward 1",
  "district": "District 1",
  "province": "HCMC",
  "country": "Vietnam",
  "isDefault": true
}
```

### Update Address
```http
PATCH /api/user-addresses/:id
```

### Delete Address
```http
DELETE /api/user-addresses/:id
```

### Set Default
```http
PATCH /api/user-addresses/:id/set-default
```

---

## Products

### List Products (collections)
```http
GET /api/products                      # All products
GET /api/products/new                  # New products (tag-based)
GET /api/products/limited              # Limited edition
GET /api/products/trending             # Trending products
GET /api/products/sale                 # Sale/discounted products
```

**Query params:** `page`, `limit`, `search`, `sort`, `fields`, `brandId`, `category`
**Response:**
```json
{
  "success": true,
  "data": [{
    "_id": "...",
    "name": "Product Name",
    "brandId": { "_id": "...", "name": "Brand" },
    "price": 1000000,
    "description": "...",
    "images": [{ "url": "https://...", "_id": "..." }],
    "variants": [{ "size": "50ml", "price": 1000000, "quantityInStock": 10 }],
    "tags": [{ "slug": "new", "name": "Mới" }],
    "taxonomyTerms": [{ "slug": "floral", "name": "Hương hoa" }],
    "seo": { "slug": "product-name", "embedding": [...] }
  }],
  "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
}
```

### Public Products (filtered sections)
```http
GET /api/products/public?type=trending&brand=BrandA&sortBy=price-asc&limit=10
```

Thay thế các endpoint `/new`, `/limited`, `/trending`, `/sale` cũ. Cho phép client gộp filter/server-side sort trong **một request duy nhất**.

**Query params:**

| Param | Type | Mô tả |
|-------|------|-------|
| `type` | `trending \| new \| limited` | Lọc theo section. `trending` = sort viewCount desc; `new` = sort createdAt desc; `limited` = sort price desc |
| `brand` | string | Lọc theo brand name |
| `capacity` | string | Lọc theo dung tích (VD: `50ml`) |
| `priceRange` | string | Format `min-max` (VD: `500000-2000000`) |
| `scentGroup` | string | Lọc theo scent group slug |
| `concentration` | string | Lọc theo concentration slug |
| `segment` | string | Lọc theo segment slug |
| `sortBy` | `price-asc \| price-desc \| name-asc \| name-desc` | Sắp xếp kết quả |
| `limit` | number | Số lượng trả về (mặc định 20) |

**Ghi chú:**
- Cache key = MD5 của toàn bộ filter params — mỗi tổ hợp filter có cache riêng
- Filter/sort thực hiện **server-side** sau `formatMultipleProducts`
- Không dùng aggregation — dùng Node.js filter vì capacity/scent/concentration/segment cần parse từ dữ liệu đã format
- Không hỗ trợ phân trang (giới hạn cứng bởi `limit`)

**Response:**
```json
{
  "success": true,
  "data": [{
    "_id": "...", "name": "...", "brand": "Chanel",
    "price": 1500000, "viewCount": 250,
    "images": [...], "variants": [...], "tags": [...], "taxonomyTerms": [...]
  }]
}
```

### Bulk Fetch Products
```http
GET /api/products/bulk?ids=id1,id2,id3
```

Fetch nhiều sản phẩm cùng lúc theo danh sách ObjectId. Dùng cho AI Chat để tránh N+1 request.

**Query params:**

| Param | Type | Mô tả |
|-------|------|-------|
| `ids` | string | Comma-separated ObjectId, tối đa **20 IDs** |

**Ghi chú:**
- ObjectId không hợp lệ bị lọc bỏ tự động
- Kết quả trả về theo thứ tự xuất hiện trong DB (không theo thứ tự IDs gửi lên)
- Dùng `$in` query + `formatMultipleProducts`

**Response:**
```json
{
  "success": true,
  "data": [{ "_id": "...", "name": "...", "brand": "...", "price": 1500000, "images": [...], "variants": [...], "tags": [...], "taxonomyTerms": [...] }]
}
```

### Suggest Products (autocomplete)
```http
GET /api/products/suggest?q=perf&limit=5
```

Endpoint nhẹ cho autocomplete search. Chỉ trả về các field cần thiết: `_id`, `name`, `price`, `image`, `brandId(name)`.

**Query params:**

| Param | Type | Mô tả |
|-------|------|-------|
| `q` | string | Query string — prefix regex match trên `name` (case-insensitive) |
| `limit` | number | Số lượng gợi ý tối đa (mặc định 5) |

**Ghi chú:**
- Index hỗ trợ: `{ tenantId: 1, name: 1 }`
- Tránh `formatMultipleProducts` — select trực tiếp field cần
- Ký tự đặc biệt trong query được escape trước khi regex
- Cache TTL: **300 giây**
- AI fallback xử lý ở frontend (gọi `POST /api/ai/autocomplete` khi không có kết quả)

**Response:**
```json
{
  "success": true,
  "data": [
    { "_id": "...", "name": "Perfume Chanel", "price": 1500000, "image": "https://...", "brandId": { "_id": "...", "name": "Chanel" } }
  ]
}
```

### Get Product by ID
```http
GET /api/products/:id
```

### Create Product (Admin/Subadmin)
```http
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Perfume",
  "brandId": "...",
  "description": "A luxurious fragrance...",
  "price": 1500000
}
```

### Update Product (Admin/Subadmin)
```http
PATCH /api/products/:id
Authorization: Bearer <token>
```

### Delete Product (Admin/Subadmin)
```http
DELETE /api/products/:id
Authorization: Bearer <token>
```

### Bulk Delete Products (Admin/Subadmin)
```http
POST /api/products/bulk-delete
Authorization: Bearer <token>
Content-Type: application/json

{ "ids": ["id1", "id2", "..."] }
```

---

## Product Images

### Get Product Images
```http
GET /products/:productId/images
```

### Get Primary Image
```http
GET /products/:productId/images/primary
```

### Get Image Count
```http
GET /products/:productId/images/count
```

### Add Image
```http
POST /products/images
Content-Type: application/json

{ "productId": "...", "url": "https://..." }
```

### Add Multiple Images
```http
POST /products/images/bulk
Content-Type: application/json

{ "productId": "...", "images": ["https://...", "https://..."] }
```

### Update Image URL
```http
PUT /products/images/:imageId
Content-Type: application/json

{ "url": "https://..." }
```

### Delete Image
```http
DELETE /products/images/:imageId
```

### Delete All Product Images
```http
DELETE /products/:productId/images
```

---

## Brands

### List Brands
```http
GET /api/brands
```

### Get Brand Origins
```http
GET /api/brands/origins
```

### Get Brand by ID
```http
GET /api/brands/:id
```

### Create Brand (Admin/Subadmin)
```http
POST /api/brands
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "Chanel", "origin": "France", "description": "...", "featured": true }
```

### Update Brand (Admin/Subadmin)
```http
PATCH /api/brands/:id
```

### Delete Brand (Admin/Subadmin)
```http
DELETE /api/brands/:id
```

### Bulk Delete Brands (Admin/Subadmin)
```http
POST /api/brands/bulk-delete
```

---

## Tags

### List Tags
```http
GET /api/tags
```

### Get Tag by ID
```http
GET /api/tags/:id
```

### Create Tag (Admin/Subadmin)
```http
POST /api/tags
Authorization: Bearer <token>
{ "name": "New Collection", "slug": "new-collection" }
```

### Update Tag (Admin/Subadmin)
```http
PATCH /api/tags/:id
```

### Delete Tag (Admin/Subadmin)
```http
DELETE /api/tags/:id
```

---

## Taxonomies

### v1 — Unified (Segment, Scent Group, Concentration)

```http
GET /api/taxonomies?type=segment          # List by type
GET /api/taxonomies/active?type=segment   # Only active
GET /api/taxonomies/:id
POST /api/taxonomies                      # Auth required
PATCH /api/taxonomies/:id                  # Auth required
DELETE /api/taxonomies/:id                 # Auth required
```

**Type values:** `segment`, `scent_group`, `concentration`

### v2 — Taxonomy + Terms (nested)

```http
GET /api/v2/taxonomies                                      # List taxonomies
GET /api/v2/taxonomies/:id                                  # Get taxonomy
GET /api/v2/taxonomies/:taxonomyId/terms                    # List terms
GET /api/v2/taxonomies/:taxonomyId/terms?active=true        # Active terms
GET /api/v2/taxonomies/:taxonomyId/terms/:id                # Get term
POST /api/v2/taxonomies                                     # Create taxonomy (auth)
PATCH /api/v2/taxonomies/:id                                 # Update taxonomy (auth)
DELETE /api/v2/taxonomies/:id                                # Delete + cascade terms (auth)
POST /api/v2/taxonomies/:taxonomyId/terms                   # Create term (auth)
PATCH /api/v2/taxonomies/:taxonomyId/terms/:id               # Update term (auth)
DELETE /api/v2/taxonomies/:taxonomyId/terms/:id               # Delete term (auth)
```

### Legacy Segments
```http
GET /api/segments        # Alias for /api/taxonomies?type=segment
```
**Deprecated:** Kept for backward compatibility.

---

## Orders

All endpoints require `Authorization: Bearer <token>`.

### My Orders
```http
GET /api/orders/my-orders

Response: 200 { "success": true, "data": [...], "pagination": {...} }
```

### Get Order by ID
```http
GET /api/orders/:id
```

### Admin — List All Orders
```http
GET /api/orders/admin/orders
Authorization: Bearer <token> (ADMIN/SUBADMIN)

Query params: page, limit, status, paymentStatus, search, startDate, endDate
Response: 200 { "success": true, "data": { "orders": [...], "pagination": {...} } }
```

### Admin — Get Order by ID
```http
GET /api/orders/admin/:id
Authorization: Bearer <token> (ADMIN/SUBADMIN)
```

### Admin — Update Order Status
```http
PATCH /api/orders/admin/:id/status
Authorization: Bearer <token> (ADMIN/SUBADMIN)
Content-Type: application/json

{ "status": "processing" }  # pending | processing | shipped | delivered | cancelled
```

### Admin — Update Payment Status
```http
PATCH /api/orders/admin/:id/payment-status
Authorization: Bearer <token> (ADMIN/SUBADMIN)
Content-Type: application/json

{ "paymentStatus": "paid" }  # unpaid | paid | refunded
```

### Admin — Delete Order
```http
DELETE /api/orders/admin/:id
Authorization: Bearer <token> (ADMIN/SUBADMIN)
```

---

## Homepage Config

### Get Config
```http
GET /api/homepage-config
```
Public endpoint. Returns banner images, sections, gallery, product card config.

### Update Config (Admin/Subadmin)
```http
PUT /api/homepage-config
Authorization: Bearer <token>
Content-Type: application/json

{ "bannerTitleVi": "...", "bannerImages": [...], "sections": [...], "productCardConfig": {...} }
```

---

## Media

### Upload to R2
```http
POST /api/media/upload-r2
Content-Type: multipart/form-data

file: <image>
folder?: "products" | "brands" | "avatars"
name?: "custom-filename"

Response: 200 { "success": true, "data": { "url": "https://...", "displayUrl": "...", "originalBytes": 123, "compressedBytes": 45 } }
```
**Rate limit:** 20 req/min

### Upload from URL
```http
POST /api/media/upload-url
Content-Type: multipart/form-data

url: "https://example.com/image.jpg"
folder?: "products"

Response: 200 { "success": true, "data": { "url": "...", "originalBytes": 123, "compressedBytes": 45 } }
```
**Rate limit:** 20 req/min

---

## Vouchers

### List Vouchers
```http
GET /api/vouchers
Authorization: Bearer <token>
```
- Admin/Subadmin: Lấy tất cả vouchers
- USER: Chỉ lấy voucher đang active, còn hạn

### Get Voucher by ID
```http
GET /api/vouchers/:id
Authorization: Bearer <token>
```

### Validate Voucher Code
```http
POST /api/vouchers/validate
Content-Type: application/json

{ "code": "SALE50", "orderAmount": 1000000 }

Response: 200 { "success": true, "valid": true, "message": "...", "voucher": {...}, "discountAmount": 500000 }
```

### Create Voucher (Admin/Subadmin)
```http
POST /api/vouchers
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "SALE50",
  "type": "percentage",      # "percentage" | "fixed"
  "value": 10,               # 10 = 10%, hoặc 50000 = 50.000đ
  "minOrderAmount": 500000,
  "maxDiscount": 200000,
  "maxUsage": 100,
  "startDate": "2026-01-01",
  "endDate": "2026-12-31"
}
```

### Update Voucher (Admin/Subadmin)
```http
PATCH /api/vouchers/:id
Authorization: Bearer <token>
```

### Delete Voucher (Admin/Subadmin)
```http
DELETE /api/vouchers/:id
Authorization: Bearer <token>
```

---

## Payments

All endpoints require `Authorization: Bearer <token>` with `ADMIN` or `SUBADMIN` role.

### List Payments
```http
GET /api/payments
Authorization: Bearer <token>
Response: { "success": true, "data": [{ "orderId": {...}, "method": "bank_transfer", "amount": 1500000, "status": "paid", ... }] }
```

### Get Payment by ID
```http
GET /api/payments/:id
Authorization: Bearer <token>
```

### Get Payments by Order
```http
GET /api/payments/order/:orderId
Authorization: Bearer <token>
```

### Create Payment
```http
POST /api/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "...",
  "method": "bank_transfer",   # "cod" | "bank_transfer" | "credit_card" | "momo" | "zalopay"
  "amount": 1500000
}
```

### Mark Paid (Admin/Subadmin)
```http
PATCH /api/payments/:id/paid
Authorization: Bearer <token>
Content-Type: application/json

{ "transactionCode": "GD123456" }
```

### Mark Failed (Admin/Subadmin)
```http
PATCH /api/payments/:id/failed
Authorization: Bearer <token>
```

### Mark Refunded (Admin/Subadmin)
```http
PATCH /api/payments/:id/refunded
Authorization: Bearer <token>
```

### Delete Payment (Admin/Subadmin)
```http
DELETE /api/payments/:id
Authorization: Bearer <token>
```

---

## AI

---

## Stats

### Dashboard Stats
```http
GET /api/stats/dashboard
X-Tenant-ID: default

Response: {
  "revenueToday": 1500000,
  "newOrdersToday": 5,
  "visitsToday": 230,
  "revenuePercent": 30,
  "ordersPercent": 33,
  "visitsPercent": 23
}
```

### Track Visit
```http
POST /api/stats/track-visit
X-Tenant-ID: default

Response: { "success": true }
```

---

## Jobs (Internal — QStash)

Protected by `qstashMiddleware` (Upstash signature verification).

### Welcome Email
```http
POST /api/jobs/welcome-email
Content-Type: application/json
Upstash-Signature: <signature>

{ "email": "user@example.com", "name": "John" }
```

### Daily Cleanup
```http
POST /api/jobs/daily-cleanup
Content-Type: application/json
Upstash-Signature: <signature>
```

---

## System Endpoints

### Health Check
```http
GET /health

Response: {
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-05-20T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 12345,
  "checks": {
    "database": { "status": "up", "latencyMs": 5 },
    "redis": { "status": "up", "latencyMs": 2 }
  }
}
```

### Ping
```http
GET /ping

Response: 200 { "status": "ok", "timestamp": "..." }
Response: 503 { "status": "warming_up", "timestamp": "..." }  # DB not ready
```

### Metrics (Prometheus)
```http
GET /metrics

Response: text/plain — Prometheus metrics format
```

### Root
```http
GET /

Response: 200 { "message": "🚀 Elite SaaS Backend API is running smoothly!", "version": "1.0.0", "systemStatus": "healthy" }
```

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |

**Standard error response:**
```json
{
  "success": false,
  "message": "Error description"
}
```
