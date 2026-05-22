# Backend API - Elite SaaS 2026

Hệ thống Backend chuẩn doanh nghiệp cho E-commerce, tập trung vào bảo mật, hiệu suất và trí tuệ nhân tạo (AI-Native). Được xây dựng dựa trên triết lý **"Elite Performance & Security First"**.

---

## 🔥 Tính năng chính

### 🛡️ Authentication & Security
- **JWT Authentication** - Access token (15min) + Refresh token (7 days)
- **OAuth 2.0** - Google login integration
- **Two-Factor Authentication (2FA)** - TOTP với QR code
- **Dynamic Rate Limiting** - Guest: 100/min, User: 500/min, Admin: unlimited
- **Helmet Security Headers** - XSS, HSTS, CSP protection
- **Audit Logging** - Track sensitive actions

### 🧠 AI & Machine Learning
- **Multimodal AI (Gemini 3.1 Flash-Lite)** - Vision + text generation
- **Semantic Search** - Gemini Embedding 2 (3072 dimensions)
- **Hybrid RAG System** - Vector + keyword search với RRF algorithm
- **Delta Indexing** - MD5 hash để chỉ index những gì thay đổi
- **AI Agent System** - LangGraph cho complex workflows

### 🛒 E-commerce Core
- **Product Management** - CRUD với variants, images, SEO
- **Order Processing** - Cart, checkout, order tracking
- **Brand & Taxonomy** - Phân loại sản phẩm thông minh
- **Tag System** - Standard tags cho filtering
- **User Addresses** - Multiple shipping addresses per user

### 🖼️ Media Processing
- **Image Optimization** - Sharp + WebP, giảm 80%+ dung lượng
- **Cloudflare R2 Storage** - Zero egress fees
- **Multi-image Upload** - Batch processing
- **Automatic Resizing** - Multiple sizes cho responsive

### ⚡ Performance & Scalability
- **Redis Caching** - Session, rate limit, API responses
- **Background Jobs** - Upstash QStash cho async tasks
- **Connection Pooling** - MongoDB + Redis
- **Lean Queries** - Optimized database access
- **Compression** - Gzip/Brotli response compression

### 📊 Monitoring & Analytics
- **Sentry** - Real-time error tracking
- **PostHog** - Product analytics & feature flags
- **Prometheus Metrics** - `/metrics` endpoint
- **Health Checks** - `/health` với DB + Redis status
- **Structured Logging** - Pino với pretty print

---

## 🛠️ Tech Stack

- **Runtime**: Node.js v22+ (ESM, native TypeScript support)
- **Framework**: Fastify 5.x (plugin-based architecture)
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Cache**: Redis (ioredis)
- **AI**: Google Gemini 3.1 Flash-Lite + Embedding 2
- **Storage**: Cloudflare R2 (S3-compatible)
- **Jobs**: Upstash QStash (serverless queue)
- **Email**: Resend + Nodemailer fallback
- **Monitoring**: Sentry + PostHog + Prometheus
- **Testing**: Vitest
- **Validation**: Zod
- **Image Processing**: Sharp

---

## 📂 Project Structure

```text
Backend-api/
├── src/
│   ├── app.ts                 # Fastify app setup
│   ├── server.ts              # Server entry point
│   │
│   ├── controllers/           # HTTP handlers (14 controllers)
│   │   ├── AuthController.ts
│   │   ├── ProductController.ts
│   │   ├── OrderController.ts
│   │   ├── AIController.ts
│   │   └── ...
│   │
│   ├── services/              # Business logic (20+ services)
│   │   ├── AuthService.ts
│   │   ├── AIService.ts
│   │   ├── ProductService.ts
│   │   ├── SearchService.ts
│   │   └── ...
│   │
│   ├── models/                # Mongoose schemas (15 models)
│   │   ├── User.ts
│   │   ├── Product.ts
│   │   ├── Order.ts
│   │   ├── Knowledge.ts
│   │   └── ...
│   │
│   ├── routes/                # API endpoints
│   ├── middleware/            # Auth, error handling, logging
│   ├── plugins/               # Fastify plugins
│   ├── config/                # DB, Redis, Sentry config
│   ├── utils/                 # Helpers
│   ├── jobs/                  # Background jobs
│   └── scripts/               # Migration scripts
│
├── Docs/                      # 📚 Detailed documentation
│   ├── PROJECT_STRUCTURE.md   # Architecture & folder structure
│   ├── TECH_STACK.md          # Technology choices & benchmarks
│   ├── API_CONVENTIONS.md     # API design & response format
│   ├── CODING_STANDARDS.md    # Code style & best practices
│   ├── DATABASE_SCHEMA.md     # MongoDB schemas & indexes
│   └── ENV_VARIABLES.md       # Environment configuration
│
├── .env.example               # Environment template
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v22+
- MongoDB Atlas account
- Redis instance (Upstash recommended)
- Gemini API key

### Installation

```bash
# Clone repository
git clone <repo-url>
cd Backend-api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Configure .env with your credentials
# See Docs/ENV_VARIABLES.md for details

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev              # Development with watch mode
npm run build            # Build for production
npm start                # Start production server
npm test                 # Run tests
npm run migrate:images   # Migrate product images to R2
npm run migrate:orders   # Migrate order items
```

---

## 📚 Documentation

For detailed technical documentation:

- **[Project Structure](./Docs/PROJECT_STRUCTURE.md)** — Architecture, layers, data flow, request lifecycle
- **[Tech Stack](./Docs/TECH_STACK.md)** — Technologies, why we chose them, benchmarks
- **[API Conventions](./Docs/API_CONVENTIONS.md)** — API design conventions, authentication, rate limiting
- **[API Reference](./Docs/API_REFERENCE.md)** — Complete endpoint listing with request/response examples
- **[Coding Standards](./Docs/CODING_STANDARDS.md)** — TypeScript patterns, best practices, code review checklist
- **[Database Schema](./Docs/DATABASE_SCHEMA.md)** — All 18 MongoDB collections, indexes, relationships
- **[AI Architecture](./Docs/AI_ARCHITECTURE.md)** — AI system deep dive (Gemini, LangGraph, RAG, Eval)
- **[Environment Variables](./Docs/ENV_VARIABLES.md)** — Configuration guide, security best practices

For feature details, see [FEATURES.md](./FEATURES.md)

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/google` - Google OAuth login
- `POST /api/2fa/setup` - Setup 2FA
- `POST /api/2fa/verify` - Verify 2FA code

### Products
- `GET /api/products` - List products (with pagination, filters)
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (admin)
- `PATCH /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Orders
- `GET /api/orders` - List user orders
- `GET /api/orders/:id` - Get order details
- `POST /api/orders` - Create order
- `PATCH /api/orders/:id` - Update order status (admin)

### AI
- `POST /api/ai/chat` - AI chat with RAG
- `POST /api/ai/search` - Semantic search
- `POST /api/ai/index` - Index knowledge base

### Media
- `POST /api/media/upload` - Upload and optimize images

See [API_CONVENTIONS.md](./Docs/API_CONVENTIONS.md) for complete API documentation.

---

## 🏗️ Architecture

**Layered Architecture:**
```
Request → Middleware → Controller → Service → Repository → Database
```

**Key Principles:**
- **Type Safety** - Full TypeScript strict mode
- **Separation of Concerns** - Clear layer responsibilities
- **Dependency Injection** - Testable, maintainable code
- **Error Handling** - Custom error classes with proper HTTP codes
- **Security First** - Input validation, sanitization, rate limiting
- **Performance** - Caching, lean queries, batch operations

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- product.service.test.ts
```

---

## 📦 Deployment

### Environment Variables
Configure all required variables (see [ENV_VARIABLES.md](./Docs/ENV_VARIABLES.md)):
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Strong random secret (min 32 chars)
- `GEMINI_API_KEY` - Google AI API key
- `R2_*` - Cloudflare R2 credentials
- `SENTRY_DSN` - Error tracking
- `POSTHOG_API_KEY` - Analytics

### Build & Deploy

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Health Checks
- `GET /health` - Full health check (DB + Redis)
- `GET /ping` - Quick ping (instant response)
- `GET /metrics` - Prometheus metrics

---

## 🤝 Contributing

1. Follow [Coding Standards](./Docs/CODING_STANDARDS.md)
2. Write tests for new features
3. Update documentation
4. Submit pull request

---

## 📝 License

Dự án được bảo mật và thuộc quyền sở hữu cá nhân. Vui lòng không sao chép khi chưa được phép.

---

## 📞 Support

For technical questions, see documentation in `Docs/` folder.

---

*Developed by Antigravity AI - Elite SaaS Stack 2026*
