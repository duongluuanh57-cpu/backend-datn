# Project Structure — Elite SaaS Backend

## Tổng quan kiến trúc

Backend được xây dựng theo kiến trúc **Layered Architecture** với pattern **Static Class Services** trên nền tảng **Fastify 5.x + TypeScript (ESM)**.

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Fastify App (app.ts)                                       │
│  • CORS, Helmet, Compress                                   │
│  • Rate Limiter (Dynamic: Guest 60, User 300, Admin 5000)  │
│  • Zod Validator + Serializer Compiler                      │
│  • Raw Body (QStash/Stripe webhook)                         │
│  • Core Plugin (DI: Redis, Auth, AI, QStash, PostHog)      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Middleware                                                  │
│  • authMiddleware — JWT Bearer verification + RBAC          │
│  • requireRole('ADMIN', 'SUBADMIN') — Role-based access    │
│  • qstashMiddleware — Upstash QStash signature verification │
│  • errorHandler — 4-layer error processing                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Routes → Controllers (Static Class Methods)                │
│  • Parse & validate request (Zod schemas)                   │
│  • Call Service layer                                       │
│  • Format JSON response { success, data/pagination }        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Services (Static Class — Business Logic)                   │
│  • AuthService — Register, Login, Logout, OAuth, 2FA       │
│  • ProductService — CRUD, variants, images, tags, SEO      │
│  • AIService — Gemini AI (cascade fallback + retry)        │
│  • AgentService — LangGraph multi-agent workflow           │
│  • SearchService — Hybrid search (keyword + semantic)      │
│  • ImageService — Sharp optimization + R2 upload           │
│  • QStashService — Background job queue                    │
│  • StatsService — Dashboard analytics                      │
│  • EmailService — SMTP (Gmail/Nodemailer)                 │
│  + 14 more services...                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Repositories (Data Access Layer)                           │
│  • UserRepository — Mongoose queries with multi-tenancy    │
│  • Direct model access trong services                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Models (Mongoose Schemas — 18 collections)                 │
│  • Multi-tenancy plugin (tenantId auto-filter)              │
│  • Virtual fields, indexes, hooks (post('save') AI train)  │
│  • MongoDB Atlas vector search (3072d embeddings)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  External Services                                          │
│  • MongoDB Atlas — Primary database                         │
│  • Redis (Upstash) — Cache, sessions, rate limiting        │
│  • Cloudflare R2 — Image storage (S3-compatible)          │
│  • Upstash QStash — Background job queue                  │
│  • Google Gemini AI — LLM + Embedding + Vision            │
│  • Sentry — Error tracking                                 │
│  • PostHog — Product analytics                             │
│  • SMTP (Gmail/Resend) — Transactional email              │
└─────────────────────────────────────────────────────────────┘
```

---

## Cấu trúc thư mục

```
Backend-api/
├── .env                          # Environment variables (local)
├── .env.example                  # Template for required vars
├── package.json                  # 75 dependencies
├── tsconfig.json                 # TypeScript strict, ES2022, NodeNext
├── vitest.config.ts              # Vitest config (V8 coverage)
│
├── Docs/                         # Kho tài liệu kỹ thuật
│   ├── PROJECT_STRUCTURE.md      # File này
│   ├── TECH_STACK.md             # Công nghệ & benchmarks
│   ├── API_CONVENTIONS.md        # API design conventions
│   ├── API_REFERENCE.md          # Complete endpoint listing
│   ├── CODING_STANDARDS.md       # Code patterns & best practices
│   ├── DATABASE_SCHEMA.md        # All 18 collections
│   ├── AI_ARCHITECTURE.md        # AI system deep dive
│   └── ENV_VARIABLES.md          # Environment guide
│
├── edge/
│   └── worker.ts                 # Cloudflare Worker (edge caching)
│
├── scratch/                      # Debug/adhoc scripts
│
└── src/
    ├── app.ts                    # Fastify app factory (buildApp)
    ├── server.ts                 # Entry point (start server)
    │
    ├── config/                   # Infrastructure configuration
    │   ├── database.ts           # Mongoose connection (MONGO_URI)
    │   ├── redis.ts              # ioredis singleton (lazyConnect)
    │   ├── sentry.ts             # Sentry init (production only)
    │   ├── metrics.ts            # Prometheus metrics registry
    │   └── storage.ts            # Cloudflare R2 config
    │
    ├── plugins/
    │   └── core.ts               # Fastify plugin — DI container
    │                              # Decorates: db, redis, authService,
    │                              # aiService, qstashService,
    │                              # postHogService, agentService
    │
    ├── middleware/
    │   ├── authMiddleware.ts      # JWT verify + requireRole()
    │   ├── errorHandler.ts       # Global error handler (4 layers)
    │   └── qstashMiddleware.ts   # Upstash QStash signature verify
    │
    ├── controllers/              # 21 HTTP controllers (barrel files)
    │   ├── AuthController.ts      # Barrel → auth/
    │   ├── TwoFactorController.ts # 2FA setup, enable, verify
    │   ├── OAuthController.ts    # Google OAuth flow
    │   ├── UserController.ts     # User CRUD (admin)
    │   ├── UserAddressController.ts # Barrel → userAddress/
    │   ├── ProductController.ts  # Barrel → product/
    │   ├── ProductImageController.ts # Image CRUD per product
    │   ├── BrandController.ts    # Brand CRUD + origins
    │   ├── TagController.ts      # Tag CRUD
    │   ├── TaxonomyController.ts # Taxonomy CRUD (unified)
    │   ├── TaxonomyTermController.ts # Barrel → taxonomy/
    │   ├── OrderController.ts    # Barrel → order/
    │   ├── HomepageConfigController.ts # Config CRUD
    │   ├── MediaController.ts    # Upload (R2/ImgBB/URL)
    │   ├── JobController.ts      # QStash job handlers
    │   ├── AICoreController.ts   # generate, runAgent
    │   ├── AIChatController.ts   # Barrel → aiChat/
    │   ├── AICatalogController.ts # Barrel → aiCatalog/
    │   ├── AIVisionController.ts # scanGalleryImage
    │   ├── PaymentController.ts  # Payment CRUD + lifecycle
    │   ├── VoucherController.ts  # Voucher CRUD + validate code
    │   │
    │   ├── auth/                  # Auth sub-controllers
    │   │   ├── authSessionController.ts   # register, login, refresh, logout
    │   │   └── authProfileController.ts   # changePassword, updateProfile, getMe
    │   ├── aiChat/                # AI Chat sub-controllers
    │   │   ├── aiChatController.ts        # chatStream, supportChat, adminChat
    │   │   ├── aiChatFeedbackController.ts # feedback
    │   │   └── aiChatSupportController.ts # supportChat
    │   ├── aiCatalog/             # AI Catalog sub-controllers
    │   │   ├── aiCatalogGenerateController.ts # generateProduct, generateBrand
    │   │   ├── aiCatalogAutocompleteController.ts # autocomplete
    │   │   └── aiCatalogPriceController.ts # suggestPrice
    │   ├── order/                 # Order sub-controllers
    │   │   ├── orderQueryController.ts    # getMyOrders, getOrderById, getAllOrdersForAdmin
    │   │   └── orderMutationController.ts # createOrder, updateOrderStatus, cancelOrder
    │   ├── product/               # Product sub-controllers
    │   │   ├── productListingController.ts  # getNewProducts, getLimitedProducts, getTrendingProducts, getSaleProducts, getAllProducts, getProductById
    │   │   └── productMutationController.ts # createProduct, updateProduct, deleteProduct, bulkDeleteProducts
    │   ├── taxonomy/              # Taxonomy sub-controllers
    │   │   ├── taxonomyController.ts      # Taxonomy CRUD
    │   │   └── taxonomyTermController.ts  # Term CRUD (nested)
    │   └── userAddress/           # UserAddress sub-controllers
    │       └── userAddressController.ts   # CRUD addresses + setDefault
    │
    ├── services/                  # 29 business logic services (barrel files)
    │   ├── AdminToolService.ts    # Barrel → adminTool/
    │   ├── AIService.ts           # Barrel → ai/
    │   ├── ProductService.ts      # Barrel → product/
    │   ├── AuthService.ts         # JWT, bcrypt, audit log, PostHog
    │   ├── OAuthService.ts        # Google OAuth logic
    │   ├── TwoFactorService.ts    # TOTP (speakeasy)
    │   ├── EmailService.ts        # SMTP (Nodemailer + Gmail)
    │   ├── ProductImageService.ts # Image operations
    │   ├── ImageService.ts        # Sharp optimize + R2 upload/delete
    │   ├── BrandService.ts        # Brand CRUD
    │   ├── TagService.ts          # Tag CRUD
    │   ├── TaxonomyService.ts     # Taxonomy CRUD (v1)
    │   ├── TaxonomyTermService.ts # TaxonomyTerm CRUD (v2)
    │   ├── SearchService.ts       # Hybrid search (MongoDB aggregate pipeline)
    │   ├── AgentService.ts        # LangGraph multi-agent (Research → Write → Review)
    │   ├── RedisService.ts        # Permanent AI cache service
    │   ├── QStashService.ts       # Upstash QStash publish + schedule
    │   ├── HealthCheckService.ts  # DB + Redis ping checks
    │   ├── StatsService.ts        # Dashboard stats (revenue, orders, visits)
    │   ├── SupportService.ts      # Chat orchestration (RAG + Agent + Eval)
    │   ├── EvalService.ts         # LLM-as-a-Judge (faithfulness scoring)
    │   ├── FailoverService.ts     # Multi-region failover monitor
    │   ├── SelfHealingService.ts  # Auto-recover DB/Redis
    │   ├── PostHogService.ts      # Analytics events + feature flags
    │   ├── PaymentService.ts      # Payment CRUD + lifecycle
    │   ├── VoucherService.ts      # Voucher CRUD + validate + increment usage
    │   ├── DocsService.ts         # Fetch GitHub docs cho Admin AI context
    │   ├── BatchBufferService.ts  # Batch gom nhiều chat request vào 1 lần gọi Gemini
    │   └── ConcurrencyLimiter.ts  # Giới hạn 10 Gemini call đồng thời, queue 200
    │   │
    │   ├── adminTool/             # AdminTool sub-services
    │   │   ├── adminToolDeclarations.ts # getDeclarations, getUserDeclarations
    │   │   └── adminToolExecutor.ts     # AdminToolExecutor (execute, listOrders, getOrderDetail)
    │   ├── ai/                    # AI sub-services
    │   │   ├── aiChatService.ts          # chat, stream
    │   │   ├── aiEmbeddingService.ts     # generateEmbedding, similaritySearch
    │   │   ├── aiProductService.ts       # generateProduct, generateBrand
    │   │   ├── aiCatalogService.ts       # autocomplete, suggestPrice, classify
    │   │   └── aiImageService.ts         # scanGalleryImage, identifyProduct
    │   └── product/               # Product sub-services
    │       ├── productQueryService.ts    # getNewProducts, getLimitedProducts, getTrendingProducts, getSaleProducts, getAllProducts, getProductById
    │       ├── productMutationService.ts # createProduct, updateProduct, deleteProduct, bulkDeleteProducts
    │       └── productCacheService.ts    # cache product data
    │
    ├── models/                   # 24 Mongoose models
    │   ├── User.ts               # users
    │   ├── UserAddress.ts        # user_addresses
    │   ├── Brand.ts              # brands
    │   ├── Tag.ts                # tags
    │   ├── Product.ts            # products
    │   ├── ProductImage.ts       # product_images
    │   ├── ProductVariant.ts     # product_variants
    │   ├── ProductSEO.ts         # product_seo
    │   ├── ProductTag.ts         # product_tags
    │   ├── ProductTaxonomy.ts    # product_taxonomies (v1)
    │   ├── ProductTaxonomyTerm.ts # product_taxonomy_terms (v2)
    │   ├── Taxonomy.ts           # taxonomies
    │   ├── TaxonomyTerm.ts       # taxonomy_terms
    │   ├── Segment.ts            # segments (legacy)
    │   ├── ScentGroup.ts         # scent_groups (legacy)
    │   ├── Concentration.ts      # concentrations (legacy)
    │   ├── Order.ts              # orders
    │   ├── OrderItem.ts          # order_items
    │   ├── HomepageConfig.ts     # homepage_configs
    │   ├── Content.ts            # contents
    │   ├── Knowledge.ts          # knowledge
    │   ├── AuditLog.ts           # audit_logs
    │   ├── Payment.ts            # payments
    │   └── Voucher.ts            # vouchers
    │
    ├── routes/                   # 20 route files
    │   ├── auth.routes.ts        # POST register, login, refresh, logout...
    │   ├── twoFactor.routes.ts   # POST setup, enable, verify
    │   ├── oauth.routes.ts       # GET google, google/callback
    │   ├── user.routes.ts        # GET, PATCH, DELETE users (admin)
    │   ├── user-address.routes.ts # CRUD addresses
    │   ├── product.routes.ts     # CRUD + collections (new, limited, trending, sale)
    │   ├── brand.routes.ts       # CRUD + origins
    │   ├── tag.routes.ts         # CRUD
    │   ├── taxonomy.routes.ts    # CRUD v1 (unified)
    │   ├── taxonomy-v2.routes.ts # CRUD v2 (Taxonomy + Terms)
    │   ├── segment.routes.ts     # Legacy alias → taxonomy
    │   ├── order.routes.ts       # GET my-orders, :id, /admin/*
    │   ├── homepage.routes.ts    # GET, PUT config
    │   ├── media.routes.ts       # POST upload-r2, upload-imgbb, upload-url
    │   ├── ai.routes.ts          # POST generate, chat, agent, support, feedback...
    │   ├── stats.routes.ts       # GET dashboard, POST track-visit
    │   ├── voucher.routes.ts     # GET, POST, PATCH, DELETE vouchers
    │   ├── payment.routes.ts     # GET, POST, PATCH payments
    │   ├── category.routes.ts    # GET homepage categories
    │   ├── job.routes.ts         # POST welcome-email, daily-cleanup, self-heal, failover-check
    │   └── productImageRoutes.ts # Image CRUD per product
    │
    ├── types/                    # TypeScript type definitions
    │   ├── user.types.ts         # Zod schemas: Register, Login, ChangePassword
    │   ├── ai.types.ts           # AIPromptInput
    │   └── feature.types.ts      # Zod schemas: 2FA, AI prompts
    │
    ├── utils/
    │   ├── auth.ts               # JWT: generateTokens, verifyAccessToken, verifyRefreshToken
    │   ├── crypto.ts             # AES-256-GCM encrypt/decrypt (2FA secrets)
    │   ├── errors.ts             # AppError base + NotFound, Validation, Unauthorized, Conflict
    │   └── multiTenancyPlugin.ts # Mongoose plugin: auto-filter tenantId
    │
    ├── repositories/
    │   └── UserRepository.ts     # User data access layer
    │
    ├── scripts/                  # 15 migration/utility scripts
    │
    └── tests/
        ├── setup.ts
        └── unit/                 # Vitest unit tests
```

---

## Request Lifecycle (Chi tiết)

```
1. HTTP Request đến server (port 4000)
2. Fastify nhận request
3. CORS check (allowed origins)
4. Helmet security headers
5. Compress (gzip/brotli negotiation)
6. Rate Limiter (check Redis counters)
   └─ Guest: 60 req/min | User: 300 req/min | Admin: 5000 req/min
7. Route matching (prefix-based: /api/auth, /api/products, ...)
8. Middleware (nếu route có preHandler):
   ├─ authMiddleware: parse JWT, set req.user
   └─ requireRole: check role (ADMIN/SUBADMIN)
9. Controller method được gọi
10. Service method xử lý business logic
    ├─ Redis cache check → hit? return cached
    ├─ MongoDB query (multi-tenancy: auto tenantId filter)
    ├─ External API calls (Gemini, R2, QStash...)
    └─ Redis cache set (TTL 5-15 min)
11. Response trả về JSON:
    ├─ Success: { success: true, data: {...}, pagination?: {...} }
    └─ Error: { success: false, error: { code, message } }
```

---

## Multi-tenancy Strategy

**Logical Isolation** — Tất cả collections đều có field `tenantId` (String).

```typescript
// Mongoose plugin tự động thêm tenantId và filter
schema.add({ tenantId: { type: String, required: true, index: true } });

// Mọi query tự động bị filter bởi tenantId
schema.pre(/^find|count|update|delete/, autoFilter);
```

- Không cần gửi header `X-Tenant-ID` — tenantId được set từ JWT claims
- Plugin đảm bảo không cross-tenant data access

---

## AI Pipeline Overview

```
User Question
    │
    ▼
AIChatController.chatStream()
    │
    ├─ 1. Adaptive Learning Check
    │      └─ Phân tích rating lịch sử → điều chỉnh system prompt
    │
    ├─ 2. Hybrid Search (SearchService)
    │      ├─ Greeting detection → mode 'greeting' (skip search)
    │      ├─ Keyword search → filter products by name/brand
    │      └─ Semantic search → Gemini Embedding 2 (3072d)
    │
    ├─ 3. Context Building
    │      ├─ Global DB info (brands, tags, scent groups...)
    │      ├─ Product search results
    │      └─ Knowledge base chunks (RAG)
    │
    ├─ 4. Gemini AI Call (AIService)
    │      ├─ Cascade: Model 1 → Model 2 → Model 3
    │      └─ Retry: 3 cycles × 3 models = 9 attempts max
    │
    ├─ 5. Cache Response (Redis + Knowledge DB)
    │
    └─ 6. Stream Response to Client (Vercel AI SDK)
```

---

## Plugin Architecture (DI)

Core Plugin (`src/plugins/core.ts`) dùng **Fastify Decorator Pattern** để inject dependencies:

```typescript
export default fp(async (app) => {
  await connectDB();
  await connectRedis();

  app.decorate('redis', redis);
  app.decorate('authService', AuthService);
  app.decorate('aiService', AIService);
  app.decorate('qstashService', QStashService);
  app.decorate('postHogService', PostHogService);
  app.decorate('agentService', AgentService);
});
```

Truy cập trong bất kỳ route/controller: `request.server.redis`, `request.server.aiService`

---

## Error Handling Strategy

4-layer error processing trong `errorHandler.ts`:

| Layer | Loại lỗi | HTTP Code |
|-------|----------|-----------|
| 1 | `AppError` (business) | Theo subclass |
| 2 | `Fastify.validation` (Zod) | 400 |
| 3 | Unhandled (500) | 500 + Sentry |
| 4 | process `unhandledRejection` + `uncaughtException` | Sentry + exit |

Custom error classes trong `src/utils/errors.ts`:
- `NotFoundError` → 404
- `ValidationError` → 400
- `UnauthorizedError` → 401
- `ConflictError` → 409

---

## Caching Strategy

| Cache | Key Pattern | TTL | Storage |
|-------|-------------|-----|---------|
| Product lists | `products:{tenant}:{type}` | 5 min | Redis |
| AI responses | `chat_cache:{sha256(query)}` | Vĩnh viễn | Redis (RedisService) |
| Agent workflows | `agent_workflow_cache:{sha256(task)}` | 24h | Redis (AgentService) |
| JWT blacklist | `blacklist:{jti}` | 7 days | Redis (AuthService) |
| Visit counters | `visits:{date}:{tenant}` | 48h | Redis (StatsService) |
| QStash idempotency | `qstash:processed:{messageId}` | - | Redis (QStash middleware) |

---

## Background Jobs (QStash)

| Job | Endpoint | Trigger | Description |
|-----|----------|---------|-------------|
| Welcome email | `POST /api/jobs/welcome-email` | On register | Gửi email chào mừng |
| Daily cleanup | `POST /api/jobs/daily-cleanup` | Cron daily | Dọn dẹp sessions, tokens |
| Self-healing | `POST /api/jobs/self-heal` | Cron hourly | Kiểm tra Redis/DB health, clear AI cache |
| Failover check | `POST /api/jobs/failover-check` | Cron 5 min | Kiểm tra region health, trigger failover nếu cần |

Jobs được xác thực bởi `qstashMiddleware` (Upstash signature verification + idempotency check).

---

## Testing

- **Framework**: Vitest v4
- **Coverage**: V8 (cấu hình trong `vitest.config.ts`)
- **Unit tests**: AuthService, BrandService, ProductService, ImageService, MultiTenancy
- **Pattern**: Mock repositories, test business logic isolation