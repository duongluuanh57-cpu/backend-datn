# Tech Stack - Elite SaaS Backend

## Core Technologies

### Runtime & Language
- **Node.js** `v22+` - Modern JavaScript runtime with native TypeScript support
  - Why: Native `--strip-types` flag, ESM support, performance improvements
  - Features: Built-in watch mode, native test runner
  
- **TypeScript** `^6.0.3` - Typed superset of JavaScript
  - Why: Type safety, better IDE support, catch errors at compile time
  - Config: Strict mode, NodeNext module resolution
  - Target: ES2022

### Web Framework
- **Fastify** `^5.8.5` - Fast and low overhead web framework
  - Why: 2x faster than Express, plugin architecture, TypeScript-first
  - Features: Schema validation, decorators, hooks, lifecycle
  - Performance: ~75,000 req/sec (vs Express ~15,000)

### Database
- **MongoDB Atlas** - Cloud-hosted NoSQL database
  - Why: Flexible schema, horizontal scaling, JSON-native
  - Features: Multi-tenancy support, vector search, aggregation pipeline
  - Driver: Mongoose `^9.6.2` for schema validation
  
- **Mongoose** `^9.6.2` - MongoDB ODM
  - Why: Schema validation, middleware, virtuals, population
  - Features: Type inference, discriminators, transactions

### Caching & Queue
- **Redis** (via ioredis `^5.10.1`) - In-memory data store
  - Why: Fast caching, session storage, rate limiting
  - Use cases: JWT blacklist, API response cache, rate limit counters
  
- **BullMQ** `^5.76.8` - Redis-based queue for background jobs
  - Why: Reliable job processing, retries, scheduling
  - Use cases: Email sending, AI indexing, cleanup tasks

### AI & Machine Learning
- **Google Gemini 3.1 Flash-Lite** - Multimodal AI model
  - SDK: `@google/generative-ai` `^0.24.1`
  - Features: Vision (image analysis), text generation, embeddings
  - Use cases: Product image analysis, document understanding
  
- **Gemini Embedding 2** - Text embedding model (3072 dimensions)
  - Why: High accuracy, multilingual support
  - Use cases: Semantic search, RAG system, similarity matching
  
- **LangChain** `^1.1.46` - AI orchestration framework
  - Why: Chain multiple AI operations, memory management
  - Features: Prompt templates, output parsers, agents
  
- **Vercel AI SDK** `^6.0.184` - AI streaming utilities
  - Why: Stream AI responses, handle tokens efficiently
  - Features: React hooks, streaming text, function calling

### Validation
- **Zod** `^4.4.3` - TypeScript-first schema validation
  - Why: Type inference, composable schemas, great error messages
  - Use cases: Request validation, environment variables, config
  - Integration: `fastify-type-provider-zod` for route schemas

### Authentication & Security
- **JWT** (`jsonwebtoken` `^9.0.3`) - JSON Web Tokens
  - Why: Stateless auth, scalable across services
  - Use cases: Access tokens (15min), refresh tokens (7 days)
  
- **bcryptjs** `^3.0.3` - Password hashing
  - Why: Secure, slow by design (prevents brute force)
  - Config: 10 rounds for hashing
  
- **Speakeasy** `^2.0.0` - 2FA/TOTP implementation
  - Why: Time-based OTP, QR code generation
  - Use cases: Two-factor authentication
  
- **Helmet** (`@fastify/helmet` `^13.0.2`) - Security headers
  - Why: XSS protection, HSTS, CSP, clickjacking prevention
  
- **CORS** (`@fastify/cors` `^11.2.0`) - Cross-Origin Resource Sharing
  - Config: Whitelist specific origins in production

### Media Processing
- **Sharp** `^0.34.5` - High-performance image processing
  - Why: Fast, memory-efficient, supports WebP
  - Use cases: Resize, compress, format conversion
  - Performance: 80%+ size reduction with WebP
  
- **QRCode** `^1.5.4` - QR code generation
  - Use cases: 2FA setup, payment links

### Storage
- **Cloudflare R2** (via `@aws-sdk/client-s3` `^3.1048.0`) - Object storage
  - Why: S3-compatible, zero egress fees, fast CDN
  - Use cases: Product images, user uploads, backups
  - Format: WebP for images, original for documents

### Background Jobs
- **Upstash QStash** `^2.11.0` - Serverless message queue
  - Why: HTTP-based, no infrastructure, automatic retries
  - Use cases: Scheduled jobs, webhooks, async tasks
  - Features: Delay, retry, dead letter queue

### Monitoring & Analytics
- **Sentry** (`@sentry/node` `^10.53.1`) - Error tracking
  - Why: Real-time error monitoring, performance tracking
  - Features: Stack traces, breadcrumbs, releases
  
- **PostHog** (`posthog-node` `^5.34.1`) - Product analytics
  - Why: Event tracking, feature flags, session replay
  - Use cases: User behavior, A/B testing
  
- **Pino** `^10.3.1` - Fast JSON logger
  - Why: Low overhead, structured logging, great performance
  - Transport: `pino-pretty` `^13.1.3` for development
  
- **Prometheus** (`prom-client` `^15.1.3`) - Metrics collection
  - Why: Industry standard, Grafana integration
  - Metrics: Request count, latency, error rate

### Email
- **Resend** `^6.12.3` - Transactional email API
  - Why: Developer-friendly, reliable delivery
  - Use cases: Welcome emails, password reset, notifications
  
- **Nodemailer** `^8.0.7` - Email sending library (fallback)
  - Why: SMTP support, attachments, HTML emails

### Rate Limiting
- **@fastify/rate-limit** `^10.3.0` - Rate limiting plugin
  - Storage: Redis for distributed rate limiting
  - Config: 100 req/15min for API, 5 req/15min for auth

### Compression
- **@fastify/compress** `^8.3.1` - Response compression
  - Why: Reduce bandwidth, faster responses
  - Formats: gzip, deflate, brotli

### Development Tools
- **Vitest** `^4.1.6` - Fast unit test framework
  - Why: Vite-powered, fast, Jest-compatible API
  - Features: Watch mode, coverage, snapshot testing
  
- **tsx** `^4.21.0` - TypeScript execution
  - Why: Run TS files directly without compilation
  - Use cases: Scripts, migrations, seeds
  
- **esbuild** `^0.28.0` - Fast bundler
  - Why: 100x faster than webpack, tree shaking
  - Use cases: Production builds
  
- **cross-env** `^10.1.0` - Cross-platform environment variables
  - Why: Works on Windows, Mac, Linux

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "cross-env NODE_OPTIONS='--max-old-space-size=2048' node --watch --watch-path=src --strip-types src/server.ts",
    "build": "esbuild src/server.ts --bundle --platform=node --target=node22 --outfile=dist/server.js --format=esm --minify --external:sharp --external:dotenv --packages=external",
    "start": "node dist/server.js",
    "test": "vitest run",
    "clean": "node -e \"const fs = require('fs'); if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true, force: true }); console.log('🧹 Cleaned dist folder')\"",
    "migrate:images": "node --strip-types src/scripts/migrate-product-images.ts",
    "migrate:orders": "node --strip-types src/scripts/migrate-order-items.ts",
    "migrate:taxonomies": "node --strip-types src/scripts/migrate-product-taxonomies.ts",
    "check:orders": "node --strip-types src/scripts/check-orders.ts",
    "seed:orders": "node --strip-types src/scripts/seed-orders.ts"
  }
}
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
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
}
```

## Why These Choices?

### Fastify over Express
- **2x faster** request handling
- **Plugin architecture** for better modularity
- **Built-in validation** with JSON Schema
- **TypeScript-first** design

### MongoDB over PostgreSQL
- **Flexible schema** for multi-tenancy
- **JSON-native** storage
- **Vector search** for AI embeddings
- **Horizontal scaling** with sharding

### Mongoose over Prisma
- **Better MongoDB support** (native driver)
- **Middleware hooks** for business logic
- **Virtual fields** and population
- **Discriminators** for polymorphic models

### Zod over Joi/Yup
- **Type inference** (no manual types)
- **Composable** schemas
- **Better error messages**
- **Smaller bundle** size

### Sharp over Jimp
- **10x faster** image processing
- **Lower memory** usage
- **Better quality** WebP output
- **Native bindings** for performance

### Vitest over Jest
- **10x faster** test execution
- **Better TypeScript** support
- **Vite-powered** (same config as build)
- **Jest-compatible** API

### Pino over Winston
- **5x faster** logging
- **Lower overhead** (async by default)
- **Structured JSON** logs
- **Better performance** in production

## Performance Benchmarks

### Framework Comparison (req/sec)
- Fastify: ~75,000 req/sec
- Express: ~15,000 req/sec
- Hono: ~130,000 req/sec (but less mature ecosystem)

### Image Processing (1920x1080 → 800x600 WebP)
- Sharp: ~50ms
- Jimp: ~500ms
- ImageMagick: ~200ms

### Logging Performance (10k logs)
- Pino: ~150ms
- Winston: ~800ms
- Bunyan: ~300ms

## Production Deployment

### Environment
- **Platform**: Render, Railway, or Fly.io
- **Node Version**: v22+
- **Memory**: 512MB minimum, 2GB recommended
- **CPU**: 1 core minimum, 2 cores recommended

### Build Process
```bash
npm run clean
npm run build
npm start
```

### Health Checks
- Endpoint: `GET /health`
- Response: `{ status: "ok", uptime: 12345 }`

## Related Documentation

- [Project Structure](./PROJECT_STRUCTURE.md)
- [API Conventions](./API_CONVENTIONS.md)
- [Coding Standards](./CODING_STANDARDS.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Environment Variables](./ENV_VARIABLES.md)
