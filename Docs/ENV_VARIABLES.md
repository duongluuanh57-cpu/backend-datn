# Environment Variables - Elite SaaS Backend

## Overview

This document describes all environment variables used in the backend API. Copy `.env.example` to `.env` and configure according to your environment.

## Required Variables

### Server Configuration

```bash
# Server port (default: 4000)
PORT=4000

# Node environment: development | production | test
NODE_ENV=development

# Logging level: trace | debug | info | warn | error | fatal
LOG_LEVEL=info
```

**Usage:**
- `PORT`: HTTP server listening port
- `NODE_ENV`: Controls error verbosity, caching behavior, logging format
- `LOG_LEVEL`: Pino logger level (use `debug` for development, `info` for production)

---

### Database & Cache

```bash
# MongoDB connection string
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/elite_saas?retryWrites=true&w=majority

# Redis connection string
REDIS_URL=redis://default:<password>@<host>:<port>
```

**MongoDB URI Format:**
```
mongodb+srv://username:password@host/database?options
```

**Redis URL Format:**
```
redis://[username]:[password]@[host]:[port]/[database]
```

**Example (Upstash Redis):**
```
redis://default:AbCdEf123456@us1-example-12345.upstash.io:6379
```

---

### AI & Machine Learning

```bash
# Google Gemini API Key
GEMINI_API_KEY=AIzaSyD...your_api_key_here
```

**How to get:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new API key
3. Copy and paste here

**Usage:**
- Gemini 3.1 Flash-Lite for multimodal AI (vision + text)
- Gemini Embedding 2 for semantic search (3072 dimensions)

---

### Security & Authentication

```bash
# JWT Secret (use strong random string)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars

# Allowed CORS origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

**Generate JWT Secret:**
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Using OpenSSL
openssl rand -hex 64
```

**CORS Origins:**
- Development: `http://localhost:3000`
- Production: `https://yourdomain.com,https://www.yourdomain.com`
- Multiple origins: Separate with commas, no spaces

---

### Google OAuth (Optional)

```bash
# Google OAuth credentials
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback

# Frontend URL for OAuth redirect
FRONTEND_URL=http://localhost:3000
```

**How to get:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - Development: `http://localhost:4000/api/auth/google/callback`
   - Production: `https://api.yourdomain.com/api/auth/google/callback`

---

### Cloudflare R2 Storage

```bash
# Cloudflare Account ID
CLOUDFLARE_ACCOUNT_ID=abc123def456

# R2 Access Credentials
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key

# R2 Bucket Configuration
R2_BUCKET_NAME=elite-saas-media
R2_PUBLIC_DOMAIN=https://pub-abc123.r2.dev
```

**How to get:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to R2 → Create Bucket
3. Create API Token with R2 permissions
4. Copy credentials

**R2 Public Domain:**
- Option 1: Use R2.dev subdomain (free): `https://pub-abc123.r2.dev`
- Option 2: Use custom domain: `https://cdn.yourdomain.com`

**Usage:**
- Store optimized product images (WebP format)
- Store user uploads
- Zero egress fees (unlike S3)

---

### Background Jobs & Messaging

```bash
# Upstash QStash Token
QSTASH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**How to get:**
1. Go to [Upstash Console](https://console.upstash.com/)
2. Create QStash project
3. Copy API token

**Usage:**
- Schedule background jobs (email sending, AI indexing)
- Webhook delivery
- Automatic retries

---

### Monitoring & Analytics

```bash
# Sentry DSN (Error Tracking)
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7654321

# PostHog (Product Analytics)
POSTHOG_API_KEY=phc_abc123def456
POSTHOG_HOST=https://us.i.posthog.com
```

**Sentry Setup:**
1. Go to [Sentry.io](https://sentry.io/)
2. Create new project (Node.js)
3. Copy DSN

**PostHog Setup:**
1. Go to [PostHog](https://posthog.com/)
2. Create account
3. Copy API key from Project Settings

**Usage:**
- Sentry: Real-time error tracking, performance monitoring
- PostHog: User analytics, feature flags, A/B testing

---

## Optional Variables

### Email Service

```bash
# Resend API Key (Transactional Email)
RESEND_API_KEY=re_abc123def456

# SMTP Fallback (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

**Resend Setup:**
1. Go to [Resend](https://resend.com/)
2. Create account
3. Add domain and verify DNS
4. Create API key

---

### Rate Limiting

```bash
# Rate limit configuration (optional, has defaults)
RATE_LIMIT_MAX=100           # Max requests per window
RATE_LIMIT_WINDOW=900000     # Window in ms (15 minutes)
```

**Defaults:**
- API endpoints: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes
- AI endpoints: 10 requests per minute

---

## Environment-Specific Configurations

### Development (.env.development)

```bash
NODE_ENV=development
PORT=4000
LOG_LEVEL=debug

MONGODB_URI=mongodb://localhost:27017/elite_saas_dev
REDIS_URL=redis://localhost:6379

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_URL=http://localhost:3000

# Use test API keys
GEMINI_API_KEY=test_key
SENTRY_DSN=  # Leave empty to disable
```

### Production (.env.production)

```bash
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

MONGODB_URI=mongodb+srv://prod_user:strong_password@cluster.mongodb.net/elite_saas_prod
REDIS_URL=redis://default:strong_password@prod-redis.upstash.io:6379

ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Use production API keys
GEMINI_API_KEY=AIzaSy...real_key
SENTRY_DSN=https://...real_dsn
```

### Testing (.env.test)

```bash
NODE_ENV=test
PORT=4001
LOG_LEVEL=error

MONGODB_URI=mongodb://localhost:27017/elite_saas_test
REDIS_URL=redis://localhost:6379

# Disable external services in tests
SENTRY_DSN=
POSTHOG_API_KEY=
```

---

## Security Best Practices

### 1. Never Commit .env Files

```bash
# .gitignore
.env
.env.local
.env.*.local
```

### 2. Use Strong Secrets

```bash
# ❌ Bad
JWT_SECRET=secret123

# ✅ Good
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 3. Rotate Secrets Regularly

- JWT Secret: Every 90 days
- API Keys: Every 180 days
- Database passwords: Every 180 days

### 4. Use Different Secrets Per Environment

```bash
# Development
JWT_SECRET=dev_secret_abc123...

# Production
JWT_SECRET=prod_secret_xyz789...
```

### 5. Limit Access

- Use read-only database users for read operations
- Use separate API keys for different services
- Implement IP whitelisting where possible

---

## Validation

The application validates environment variables on startup using Zod:

```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number),
  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  GEMINI_API_KEY: z.string().min(1),
  ALLOWED_ORIGINS: z.string(),
  // ... more validations
});

export const env = envSchema.parse(process.env);
```

**Benefits:**
- Fail fast on startup if config is invalid
- Type-safe environment variables
- Clear error messages

---

## Troubleshooting

### MongoDB Connection Issues

```bash
# Error: MongoServerError: bad auth
# Solution: Check username/password, ensure user has correct permissions

# Error: MongoNetworkError: connection timeout
# Solution: Check IP whitelist in MongoDB Atlas, allow 0.0.0.0/0 for development
```

### Redis Connection Issues

```bash
# Error: ECONNREFUSED
# Solution: Check Redis is running, verify host/port/password

# Error: NOAUTH Authentication required
# Solution: Add password to REDIS_URL
```

### CORS Issues

```bash
# Error: CORS policy blocked
# Solution: Add frontend URL to ALLOWED_ORIGINS

# Example:
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## Related Documentation

- [Project Structure](./PROJECT_STRUCTURE.md)
- [Tech Stack](./TECH_STACK.md)
- [API Conventions](./API_CONVENTIONS.md)
- [Coding Standards](./CODING_STANDARDS.md)
- [Database Schema](./DATABASE_SCHEMA.md)
