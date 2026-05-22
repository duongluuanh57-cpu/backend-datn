# Tech Stack — Elite SaaS Backend

## Core Technologies

### Runtime & Language
- **Node.js** `v22+` — Modern JavaScript runtime with native TypeScript support (`--strip-types`)
- **TypeScript** — Strict mode, ES2022 target, NodeNext module resolution

### Web Framework
- **Fastify** `^5.x` — High-performance Node.js framework
  - Plugin architecture, TypeScript-first
  - Zod integration via `fastify-type-provider-zod`
  - Performance: ~75,000 req/sec

### Database
- **MongoDB Atlas** — Cloud-hosted NoSQL database
  - Vector search (AI embeddings), aggregation pipeline
  - Multi-tenancy via logical isolation (tenantId field)
- **Mongoose** `^9.x` — MongoDB ODM
  - Schema validation, middleware hooks, virtuals
  - Custom multi-tenancy plugin (auto-filter)

### Cache
- **Redis** (via `ioredis` `^5.x`) — In-memory data store
  - Singleton pattern với lazyConnect
  - Use cases: JWT blacklist, rate limiting, AI cache, visit counters

### Queue & Background Jobs
- **Upstash QStash** `^2.x` — Serverless message queue (HTTP-based)
  - Use cases: Welcome emails, daily cleanup, self-healing
  - Features: Delay, retry, dead letter queue, cron schedules
  - Security: Signature verification + idempotency (Redis)

### AI & Machine Learning
- **Google Gemini 3.1 Flash-Lite** — Multimodal AI model
  - SDK: `@google/generative-ai`
  - Features: Vision (image analysis), text generation, embeddings
  - Pattern: Cascade fallback (3 models × 3 retries = 9 attempts max)
- **Gemini Embedding 2** — Text embedding (3072 dimensions)
  - Use cases: Semantic search, RAG, similarity matching
- **LangChain** + **@langchain/langgraph** — Multi-agent workflows
  - StateGraph: Researcher → Writer → Reviewer
- **Vercel AI SDK** `^6.x` — AI streaming utilities

### Validation
- **Zod** `^4.x` — TypeScript-first schema validation
  - Request validation (body, query, params)
  - Environment variable validation
  - Type inference (no duplicate type definitions)

### Authentication & Security
- **JWT** (`jsonwebtoken` `^9.x`) — Access + Refresh tokens
  - HS256 algorithm, issuer + audience validation
  - Token type claim (chống dùng refresh token làm access token)
- **bcryptjs** `^3.x` — Password hashing (10 rounds)
- **Speakeasy** `^2.x` — TOTP for 2FA
- **Helmet** (`@fastify/helmet`) — Security headers (XSS, HSTS, CSP)
- **CORS** (`@fastify/cors`) — Cross-Origin Resource Sharing
- **@fastify/rate-limit** — Dynamic rate limiting (Redis-backed)
  - Guest: 100/min, User: 500/min, Admin: unlimited

### Media Processing
- **Sharp** `^0.34.x` — High-performance image processing
  - WebP conversion (80%+ size reduction)
  - Thumbnail generation, resize, format conversion
- **Cloudflare R2** (via `@aws-sdk/client-s3`) — Object storage
  - S3-compatible, zero egress fees
  - Auto cache-control: `public, max-age=31536000, immutable`

### Monitoring
- **Sentry** (`@sentry/node`) — Error tracking (production only)
- **PostHog** (`posthog-node`) — Product analytics + feature flags
- **Pino** `^10.x` — Fast JSON logger (5x faster than Winston)
- **Prometheus** (`prom-client` `^15.x`) — Metrics collection
  - Default metrics: CPU, RAM, Event Loop
  - Custom: HTTP request counters

### Email
- **Nodemailer** `^8.x` — SMTP email (Gmail)
  - Welcome email template (luxury design)

### Development Tools
- **Vitest** `^4.x` — Fast unit testing (V8 coverage)
- **tsx** `^4.x` — TypeScript execution for scripts
- **esbuild** `^0.28.x` — Production bundler
- **cross-env** `^10.x` — Cross-platform env variables

---

## Why These Choices?

| Choice | Alternative | Reason |
|--------|-------------|--------|
| **Fastify** | Express (15k req/s) | 5x faster, plugin architecture, TypeScript-first |
| **MongoDB** | PostgreSQL | Flexible schema, JSON-native, vector search, horizontal scaling |
| **Zod** | Joi/Yup | Type inference, composable, better error messages |
| **Sharp** | Jimp (500ms) | 10x faster, lower memory, better WebP quality |
| **Vitest** | Jest (slow) | 10x faster, better TS support, Vite-powered |
| **Pino** | Winston (800ms) | 5x faster, structured JSON logs |
| **QStash** | BullMQ (Redis) | Serverless, HTTP-based, no Redis dependency for queue |
| **Static classes** | DI classes | Simpler pattern, no constructor injection overhead |

---

## Performance Benchmarks

### Framework (req/sec)
- Fastify: ~75,000
- Express: ~15,000

### Image Processing (1920×1080 → 800×600 WebP)
- Sharp: ~50ms
- Jimp: ~500ms

### Logging (10k logs)
- Pino: ~150ms
- Winston: ~800ms

---

## Package.json Scripts

```json
{
  "dev": "cross-env NODE_OPTIONS='--max-old-space-size=2048' node --watch --watch-path=src --strip-types src/server.ts",
  "build": "esbuild src/server.ts --bundle --platform=node --target=node22 --outfile=dist/server.js --format=esm --minify --external:sharp --external:dotenv --packages=external",
  "start": "node dist/server.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "clean": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\""
}
```

## TypeScript Configuration

```json
{
  "target": "ES2022",
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "allowImportingTsExtensions": true,
  "noEmit": true,
  "strict": true,
  "esModuleInterop": true,
  "skipLibCheck": true,
  "forceConsistentCasingInFileNames": true,
  "resolveJsonModule": true
}
```

---

## Dependencies Overview

| Category | Package | Purpose |
|----------|---------|---------|
| Framework | `fastify` | Core web framework |
| Database | `mongoose` | MongoDB ODM |
| Cache | `ioredis` | Redis client |
| AI | `@google/generative-ai` | Gemini AI SDK |
| AI | `@langchain/langgraph` | Multi-agent workflow |
| AI | `@langchain/google-genai` | LangChain × Gemini |
| AI | `ai` (Vercel) | Streaming utilities |
| Security | `jsonwebtoken` | JWT tokens |
| Security | `bcryptjs` | Password hashing |
| Security | `speakeasy` | TOTP 2FA |
| Security | `@fastify/helmet` | Security headers |
| Validation | `zod` | Schema validation |
| Queue | `@upstash/qstash` | Background jobs |
| Storage | `@aws-sdk/client-s3` | Cloudflare R2 |
| Images | `sharp` | Image processing |
| Monitoring | `@sentry/node` | Error tracking |
| Analytics | `posthog-node` | Product analytics |
| Logging | `pino` | JSON logger |
| Metrics | `prom-client` | Prometheus metrics |
| Email | `nodemailer` | SMTP email |
| Testing | `vitest` | Unit/integration tests |
| Build | `esbuild` | Production bundler |
