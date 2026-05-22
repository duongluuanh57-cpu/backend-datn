# Environment Variables — Elite SaaS Backend

## Overview

All environment variables used in the backend API. Copy `.env.example` to `.env` and configure according to your environment.

---

## Required Variables

### Server Configuration
```bash
PORT=4000                          # Server port (default: 4000)
HOST=0.0.0.0                       # Server host (default: 0.0.0.0)
NODE_ENV=development               # development | production | test
LOG_LEVEL=info                     # trace | debug | info | warn | error | fatal
APP_VERSION=1.0.0                  # Version string (used by Sentry + health)
```

### Database & Cache
```bash
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/db?retryWrites=true&w=majority
REDIS_URL=redis://default:<pass>@<host>:<port>
```

**MONGO_URI** — MongoDB Atlas connection string. Dùng `MONGO_URI` (không phải `MONGODB_URI`).
**REDIS_URL** — Redis connection (Upstash, Render, or local).

### AI & Machine Learning
```bash
GEMINI_API_KEY=AIzaSyD...your_api_key_here
```
Get from [Google AI Studio](https://makersuite.google.com/app/apikey).

### Security & Authentication
```bash
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_key_min_32_chars
ENCRYPTION_KEY=your_32_char_encryption_key_for_2fa
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
FRONTEND_URL=http://localhost:3000
```

**Generate secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**JWT_SECRET** — For access tokens (HS256, với issuer + audience validation)
**JWT_REFRESH_SECRET** — For refresh tokens (riêng biệt với access token)
**ENCRYPTION_KEY** — AES-256-GCM cho mã hóa 2FA secrets

### Cloudflare R2 Storage
```bash
CLOUDFLARE_ACCOUNT_ID=abc123def456
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=elite-saas-media
R2_PUBLIC_DOMAIN=https://pub-abc123.r2.dev
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://assets.elite-saas.com
```

Get from [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2.

### Background Jobs (QStash)
```bash
QSTASH_TOKEN=eyJhbGciOiJIUzI1NiIs...
QSTASH_CURRENT_SIGNING_KEY=whsec_...
QSTASH_NEXT_SIGNING_KEY=whsec_...
APP_WEBHOOK_URL=https://api.yourdomain.com
```

Get from [Upstash Console](https://console.upstash.com/) → QStash.
- `QSTASH_TOKEN` — API token để publish messages
- `QSTASH_CURRENT_SIGNING_KEY` + `QSTASH_NEXT_SIGNING_KEY` — Để verify webhook signatures
- `APP_WEBHOOK_URL` — Base URL cho QStash gọi đến (ví dụ: `https://api.yourdomain.com/api/jobs`)

### Email Service (SMTP)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

Cấu hình Gmail SMTP với App Password. Tạo tại [Google App Passwords](https://myaccount.google.com/apppasswords).

### Google OAuth
```bash
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
```

Get from [Google Cloud Console](https://console.cloud.google.com/).

### Monitoring
```bash
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7654321
POSTHOG_KEY=phc_abc123def456
POSTHOG_HOST=https://us.i.posthog.com
```

**Sentry**: [sentry.io](https://sentry.io/) — Error tracking (chỉ active ở production)
**PostHog**: [posthog.com](https://posthog.com/) — Product analytics

### Failover (Optional)
```bash
REGION=singapore
SECONDARY_REGION_URL=https://backup-api.yourdomain.com
```

---

## Environment-Specific Configurations

### Development
```bash
NODE_ENV=development
PORT=4000
LOG_LEVEL=debug
MONGO_URI=mongodb://localhost:27017/elite_saas_dev
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
SENTRY_DSN=                          # Disabled in dev
```

### Production
```bash
NODE_ENV=production
PORT=4000
LOG_LEVEL=info
MONGO_URI=mongodb+srv://prod_user:pass@cluster.mongodb.net/elite_saas_prod
SENTRY_DSN=https://...real_dsn       # Required
```

### Testing
```bash
NODE_ENV=test
PORT=4001
LOG_LEVEL=error
MONGO_URI=mongodb://localhost:27017/elite_saas_test
REDIS_URL=redis://localhost:6379
SENTRY_DSN=                          # Disabled
POSTHOG_KEY=                         # Disabled
```

---

## Security Best Practices

1. **Never commit .env files** — Add to `.gitignore`
2. **Use strong secrets** — Min 32 characters, random bytes
3. **Rotate secrets regularly** — JWT: 90 days, API keys: 180 days
4. **Different secrets per environment** — Dev ≠ Production
5. **IP whitelisting** — MongoDB Atlas + Redis firewall

---

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| MongoDB connection timeout | IP not whitelisted | Add current IP in MongoDB Atlas |
| Redis ECONNREFUSED | Redis not running / wrong URL | Check REDIS_URL, ensure Redis is up |
| CORS policy blocked | Origin not in ALLOWED_ORIGINS | Add frontend URL to comma-separated list |
| Auth always fails | JWT_SECRET mismatch | Same secret must be used for sign + verify |
| QStash signature invalid | Signing keys mismatch | Update QSTASH_CURRENT/NEXT_SIGNING_KEY |
