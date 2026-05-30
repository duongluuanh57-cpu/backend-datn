# Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Node.js v22+ | TypeScript natively (`--strip-types`) |
| Language | TypeScript strict | ES2022, NodeNext modules |
| Framework | Fastify 5.x | ~75k req/s, plugin architecture |
| Database | MongoDB Atlas + Mongoose | 24 collections, vector search, multi-tenancy |
| Cache | Redis (ioredis) | JWT blacklist, rate limiting, AI cache |
| Queue | Upstash QStash | Background jobs (cron, retry, DLQ) |
| AI | Google Gemini 3.1 Flash-Lite | LLM, vision, embeddings (3072d) |
| AI | LangChain + LangGraph | Multi-agent workflows (StateGraph) |
| AI | Vercel AI SDK | Streaming utilities |
| Validation | Zod 4.x | TypeScript-first schema validation |
| Auth | JWT + bcryptjs + Speakeasy (2FA) | HS256, TOTP |
| Storage | Cloudflare R2 (S3-compatible) | Image hosting, zero egress |
| Images | Sharp 0.34.x | WebP conversion, resize |
| Monitoring | Sentry + PostHog + Pino + Prometheus | Errors, analytics, logging, metrics |
| Email | Nodemailer (Gmail SMTP) | Transactional emails |
| Testing | Vitest + V8 coverage | Unit tests |
| Build | esbuild | Minified production bundle |
