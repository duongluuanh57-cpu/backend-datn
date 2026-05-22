# Backend Feature Specification

Tài liệu này chi tiết các tính năng kỹ thuật cao cấp đã được hiện thực hóa trong hệ thống Backend.

---

## 1. Authentication & Security System

### JWT Authentication
- **Access Token**: 15 phút (USER), 7 ngày (rememberMe), 365 ngày (ADMIN)
- **Refresh Token**: 7 ngày, lưu trong Redis với blacklist support
- **Token Rotation**: Refresh token cũ bị blacklist khi dùng
- **Algorithm Whitelist**: Chỉ HS256, chống Algorithm Confusion Attack
- **Issuer + Audience Validation**: RFC 7519 compliant
- **Token Type Claim**: Chống dùng refresh token thay access token

### OAuth 2.0 Integration
- **Google Login**: Full OAuth flow với callback handling
- **Account Linking**: Tự động link Google account với existing user
- **Profile Sync**: Sync avatar và profile info từ Google

### Two-Factor Authentication (2FA)
- **TOTP Implementation**: Time-based OTP với Speakeasy
- **QR Code Generation**: Tự động generate QR code cho Google Authenticator
- **Backup Codes**: Generate recovery codes khi setup 2FA
- **Secret Encryption**: AES-256-GCM cho 2FA secrets

### Security Hardening
- **Dynamic Rate Limiting**:
  - Guest: 100 requests/minute
  - User: 500 requests/minute
  - Admin: 10,000 requests/minute (unlimited)
- **Helmet Security Headers**: XSS, HSTS protection
- **CORS Configuration**: Whitelist specific origins
- **Input Validation**: Zod schemas cho tất cả endpoints
- **Audit Logging**: Track sensitive actions (login, password change, data deletion)
- **Password Hashing**: bcrypt với 10 rounds salt

---

## 2. AI & Machine Learning System

### Multimodal AI (Gemini 3.1 Flash-Lite)
- **Vision Capabilities**: Analyze product images, extract features
- **Text Generation**: Product descriptions, marketing copy
- **Structured Output**: JSON responses với type safety
- **Streaming Support**: Real-time AI responses (Vercel AI SDK)
- **Cascade Fallback**: 3 models × 3 retries = 9 attempts maximum
- **Exponential Backoff**: Tăng dần thời gian chờ giữa các retry

### Semantic Search Engine
- **Gemini Embedding 2**: 3072-dimensional vectors
- **Vector Storage**: MongoDB (ProductSEO collection)
- **Auto-Ingestion**: Product post('save') hook tự động tạo embedding
- **Similarity Search**: Cosine similarity cho semantic matching

### Hybrid Search
- **Keyword Search**: Filter products by name, brand, keywords
- **Greeting Detection**: Phát hiện chào hỏi (bỏ qua search)
- **Mode Classification**: `greeting`, `general`, `specific`
- **Debug Logging**: Ghi log vào `search_debug.log`

### RAG (Retrieval-Augmented Generation)
- **Knowledge Base**: Lưu câu hỏi-đáp (Knowledge collection)
- **Context Building**: Global DB info + search results + knowledge chunks
- **Dynamic System Prompt**: Tự động sinh dựa trên context
- **Adaptive Learning**: Điều chỉnh dựa trên rating lịch sử

### AI Agent System (LangGraph)
- **StateGraph**: 3 agents nối tiếp (Researcher → Writer → Reviewer)
- **Tool Calling**: AI có thể call functions (search, calculate, etc.)
- **Memory Management**: Redis cache cho workflow results (24h TTL)
- **Failover**: Automatic retry với exponential backoff

### LLM-as-a-Judge (EvalService)
- **Faithfulness Evaluation**: Đánh giá độ chính xác dựa trên context
- **Score**: 1-5 (5 = hoàn hảo, 1 = hallucination)
- **Test Suite**: Chạy batch evaluation trên Gold Dataset
- **Integration**: Tích hợp trong Support Chat (gửi kèm metadata)

### AI Catalog Features
- **Generate Product**: Tự động viết mô tả, keywords, meta title
- **Generate Brand**: Tự động viết câu chuyện thương hiệu
- **Autocomplete**: Gợi ý thời gian thực (streaming)
- **Suggest Price**: Gợi ý giá thị trường dựa trên sản phẩm
- **Scan Gallery Image**: AI Vision phân tích ảnh + caption song ngữ

---

## 3. E-commerce Core Features

### Product Management
- **CRUD Operations**: Full product lifecycle management
- **Variants Support**: Size, price, stock per variant (ProductVariant)
- **Image Management**: Multiple images per product (ProductImage)
- **SEO Optimization**: Meta title, description, slug, OG tags (ProductSEO)
- **Vector Embedding**: Auto-generated AI embeddings cho semantic search
- **Pricing**: Regular price, compare-at price, discount tracking
- **Tag System**: Nhiều-nhiều qua ProductTag junction table

### Brand & Taxonomy System
- **Brand Management**: Create, update, delete brands với origin tracking
- **Taxonomy Classification** (v2):
  - Scent Groups, Concentrations, Segments (unified taxonomy system)
  - Parent → Child (Taxonomy → TaxonomyTerm)
- **Standard Tags**: Predefined tags cho filtering
- **Legacy Support**: Still supports Segment, ScentGroup, Concentration collections

### Order Processing
- **Order Creation**: Cart to order conversion
- **Order Items**: Line items với product snapshots (name, price, image)
- **Order Status**: Pending → Processing → Shipped → Delivered → Cancelled
- **Payment Methods**: COD, Bank transfer, Credit card, MoMo, ZaloPay
- **User Addresses**: Multiple shipping addresses per user

### Homepage Configuration
- **Dynamic Sections**: 8 configurable sections (banner, brands, products, gallery...)
- **Bilingual Support**: Vietnamese + English (banner, gallery)
- **Product Card Customization**: Aspect ratio, colors, fonts, element ordering
- **Gallery Images**: Luxury gallery with bilingual titles + quotes

---

## 4. Media Processing System

### Image Optimization (Sharp)
- **WebP Conversion**: Automatic conversion to WebP (80%+ size reduction)
- **Multiple Sizes**: Generate thumbnail (200×200) + full size (1920px max)
- **Quality Control**: Configurable quality settings (default 90%)
- **Format Support**: JPEG, PNG, WebP input

### Cloudflare R2 Storage
- **S3-Compatible API**: via @aws-sdk/client-s3
- **Zero Egress Fees**: No bandwidth charges
- **CDN Integration**: Fast global delivery
- **Public URLs**: Direct access to optimized images
- **Cache Control**: `public, max-age=31536000, immutable`
- **Folder Management**: Upload to `products/`, `brands/`, `avatars/` prefixes
- **Bulk Delete**: Xóa folder hoặc single image

### Image Management
- **Multiple Images**: Up to 10 images per product
- **Image Ordering**: CRUD operations for each image
- **Upload Methods**: Direct file, URL import (server-side download)
- **Auto-optimization**: Tất cả ảnh tự động qua Sharp → WebP → R2

---

## 5. Performance & Scalability

### Redis Caching Strategy
- **JWT Blacklist**: Refresh token revocation
- **Rate Limiting**: Request counters (Redis-backed)
- **API Response Cache**: Product lists (5 min TTL)
- **AI Response Cache**: Vĩnh viễn (cho câu hỏi trùng)
- **Agent Workflow Cache**: LangGraph results (24h TTL)
- **Visit Counters**: Daily unique visits tracking

### Database Optimization
- **Lean Queries**: `.lean()` for read-only operations (5x faster)
- **Selective Fields**: Only fetch needed fields
- **Compound Indexes**: Multi-tenancy + filter/sort fields
- **Connection Pooling**: Mongoose connection reuse (singleton)
- **Aggregation Pipeline**: Advanced statistics (revenue, orders)

### Background Jobs (QStash)
- **Welcome Email**: Gửi sau register (5s delay)
- **Daily Cleanup**: Dọn dẹp sessions, expired tokens (cron)
- **Self-Healing**: Kiểm tra Redis memory + DB connection (cron)
- **Idempotency**: Chống xử lý trùng lặp qua Redis + message ID

### Compression
- **Response Compression**: Gzip/Brotli for API responses (`@fastify/compress`)
- **Image Compression**: WebP (80%+ size reduction)
- **JSON Minification**: esbuild minification in production build

---

## 6. Monitoring & Observability

### Error Tracking (Sentry)
- **Real-time Alerts**: Instant notification on errors (production only)
- **Stack Traces**: Full error context
- **User Context**: Request data, URL, method
- **Error Categorization**: AppError vs Validation vs Unknown

### Product Analytics (PostHog)
- **Event Tracking**: User registration, login, logout
- **Feature Flags**: `isFeatureEnabled()` for gradual rollouts
- **User Identification**: `identify()` với user properties
- **Set Once**: Track first_seen timestamp

### Prometheus Metrics
- **Default Metrics**: CPU, memory, event loop lag
- **HTTP Metrics**: Request count with labels (method, route, status_code)
- **Custom Metrics**: Business-specific counters
- **Grafana Integration**: `/metrics` endpoint

### Health Checks
- **Database Health**: MongoDB ping command (real latency)
- **Redis Health**: Redis PING command (real latency)
- **Overall Status**: healthy / degraded / unhealthy
- **Ping Endpoint**: Fast health check cho load balancers
- **Root Endpoint**: Welcome message + system status

### Structured Logging
- **Pino**: Async JSON logger (5x faster than Winston)
- **Pretty Print**: pino-pretty for development
- **Request Context**: URL, method, error details

---

## 7. Infrastructure & Reliability

### Multi-tenancy
- **Logical Isolation**: `tenantId` trên tất cả collections
- **Mongoose Plugin**: Auto-add field + auto-filter queries
- **JWT-based**: tenantId từ user claims (không cần header riêng)

### Self-Healing System
- **Redis Health Check**: Monitor memory usage > 80% → auto-clear AI cache
- **Database Monitor**: Phát hiện mất kết nối → tự động reconnect
- **Scheduled Maintenance**: Cron job chạy hàng giờ

### Failover System
- **Multi-region Monitoring**: Health check per region
- **Automatic Detection**: Phát hiện unhealthy region
- **Cloudflare Integration**: Điều hướng traffic (API-ready)
- **PostHog Alerting**: Gửi event khi failover triggered

### LLM-as-a-Judge
- **Faithfulness Scoring**: Đánh giá accuracy 1-5
- **Automated Test Suite**: Gold dataset evaluation
- **Integration**: Chat response + metadata (evalScore, isReliable)

---

## 8. Developer Experience

### TypeScript Excellence
- **Strict Mode**: Full type safety, `noUncheckedIndexedAccess`
- **Type Inference**: Zod → TypeScript type tự động
- **ESM Support**: Native ES modules with `.ts` extension
- **Node v22 Features**: Native TypeScript execution với `--strip-types`

### Hot Reload
- **Watch Mode**: `node --watch` for auto-restart
- **Fast Refresh**: Quick iteration cycle

### Testing Infrastructure
- **Vitest**: Fast unit testing (Jest-compatible API)
- **Test Coverage**: V8 coverage tracking
- **Unit Tests**: Auth, Brand, Product, Image, Multi-tenancy

### Migration Scripts
- **15 migration scripts** trong `src/scripts/`
- Seed data, migrate taxonomies, SEO, tags, variants
- Idempotent design (safe to run multiple times)

---

## 9. Production Ready

### Deployment
- **Build**: esbuild (bundle + minify)
- **Health Checks**: Kubernetes/Docker ready
- **Graceful Shutdown**: Sentry shutdown, connection cleanup

### Scalability
- **Stateless Design**: Horizontal scaling ready
- **Load Balancing**: Multiple instances support
- **Database Sharding**: MongoDB sharding ready

### Security Checklist
- ✅ JWT with short expiration + algorithm whitelist
- ✅ Password hashing (bcrypt, 10 rounds)
- ✅ Dynamic rate limiting (role-based)
- ✅ CORS configuration
- ✅ Security headers (Helmet)
- ✅ Input validation (Zod)
- ✅ NoSQL injection prevention (Mongoose)
- ✅ XSS prevention
- ✅ CSRF protection (SameSite cookies)
- ✅ Audit logging

---

## Current Implementation Status

### ✅ Completed Features
- Authentication (JWT, OAuth Google, 2FA TOTP)
- User Management (admin CRUD, profile update, addresses)
- Product Management (CRUD, variants, images, tags, SEO)
- Brand & Taxonomy (v1 unified + v2 nested)
- Homepage Configuration (sections, banner, gallery, bilingual)
- Order Processing (create, list, status tracking)
- Image Optimization (Sharp + WebP + R2)
- AI Chat (streaming, adaptive learning, vision)
- AI Multi-agent (LangGraph: Research → Write → Review)
- Hybrid Search (keyword + semantic)
- RAG System (context building, knowledge base)
- LLM-as-a-Judge (EvalService, faithfulness scoring)
- AI Catalog (generate product, brand, autocomplete, suggest price)
- AI Vision (scan gallery image, product identification)
- Rate Limiting (dynamic, role-based)
- Error Tracking (Sentry)
- Product Analytics (PostHog)
- Health Checks (DB + Redis ping)
- Background Jobs (QStash: welcome email, cleanup)
- Self-Healing (Redis memory, DB reconnect)
- Failover (multi-region monitoring)
- Prometheus Metrics
- Audit Logging

### 🚧 In Progress
- Payment Integration (Stripe)
- Email Templates (welcome, order confirmation)
- Advanced Analytics Dashboard
- Multi-language Support

### 📋 Planned Features
- Inventory Alerts
- Product Reviews
- Wishlist
- Discount Codes
- Shipping Integration
- Invoice Generation

---

*Tài liệu được biên soạn bởi Antigravity AI — Elite SaaS Stack 2026.*
