# Deployment Guide

## Build
```bash
npm run build         # esbuild → dist/server.js (minified ESM)
```

## Required Env Vars
- `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`
- `ALLOWED_ORIGINS`, `FRONTEND_URL`, `SENTRY_DSN`, `POSTHOG_KEY`

## Options

**VPS/Dedicated (recommended):**
```bash
npm run build
# Copy dist/ + package.json + .env to server
npm install --production
pm2 start dist/server.js --name elite-saas
# Nginx reverse proxy on port 4000
```

**Docker:**
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ .env ./
CMD ["node", "dist/server.js"]
```

## Health Check Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /` | Welcome + system status |
| `GET /health` | `{ status, checks: { database, redis } }` |
| `GET /ping` | Load balancer check |
| `GET /metrics` | Prometheus metrics |

## Post-Deploy Checklist
- [ ] `GET /health` → healthy
- [ ] `POST /api/auth/register + login` → JWT
- [ ] `GET /api/products` → data
- [ ] `POST /api/media/upload-r2` → success
- [ ] Sentry no errors, PostHog receiving events
