# Deployment Guide — Elite SaaS Backend

## 1. Build

```bash
# Build production bundle
npm run build

# Output: dist/server.js
# Đóng gói bằng esbuild: minified, ESM, target node22
```

## 2. Environment Variables

Copy `.env.example` → `.env` và cấu hình:

**Bắt buộc:**
- `MONGO_URI` — MongoDB Atlas connection string
- `REDIS_URL` — Redis (Upstash/Render/local)
- `JWT_SECRET` — HS256 secret (min 32 chars)
- `JWT_REFRESH_SECRET` — Refresh token secret
- `GEMINI_API_KEY` — Google AI API key

**Production critical:**
- `ALLOWED_ORIGINS` — Frontend domains
- `FRONTEND_URL` — Frontend base URL (OAuth redirect)
- `SENTRY_DSN` — Error tracking
- `POSTHOG_KEY` — Analytics

## 3. Deploy lên Production

### Option A: VPS / Dedicated (Recommended)

```bash
# 1. Build
npm run build

# 2. Copy lên server
rsync -avz dist/ user@server:/app/dist
rsync -avz package.json user@server:/app/
rsync -avz .env.production user@server:/app/.env

# 3. Install dependencies
cd /app && npm install --production

# 4. Start với process manager (PM2)
npm install -g pm2
pm2 start dist/server.js --name elite-saas

# 5. Reverse proxy (Nginx)
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option B: Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY .env ./
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

### Option C: Serverless (coming soon)

Hiện tại chưa hỗ trợ serverless deployment. Cần thêm adapter nếu muốn chạy trên Vercel/AWS Lambda.

## 4. Database Migrations

```bash
# Chạy migration scripts
npx tsx src/scripts/migrate-taxonomy.ts
npx tsx src/scripts/migrate-tags.ts
npx tsx src/scripts/migrate-variants.ts
npx tsx src/scripts/migrate-seo.ts

# Seed data
npx tsx src/scripts/seed-orders.ts
npx tsx src/scripts/seed-seo.ts

# Cleanup (chạy định kỳ)
npx tsx src/scripts/cleanup-dummy-orders.ts
npx tsx src/scripts/cleanup-orphan-seo.ts
npx tsx src/scripts/cleanup-duplicates.ts
```

## 5. Post-Deploy Checklist

- [ ] `GET /health` → status "healthy"
- [ ] `GET /ping` → 200 OK
- [ ] `POST /api/auth/register` → tạo user thành công
- [ ] `POST /api/auth/login` → nhận JWT
- [ ] `GET /api/products` → trả về products
- [ ] `POST /api/ai/generate` → AI response
- [ ] `POST /api/media/upload-r2` → upload ảnh thành công
- [ ] Sentry không có lỗi mới
- [ ] PostHog nhận events

## 6. Monitoring

```bash
# Health check (mỗi 30s)
curl https://api.yourdomain.com/health

# Metrics (Prometheus scrape)
curl https://api.yourdomain.com/metrics

# Logs
pm2 logs elite-saas
```

## 7. Scaling

| Bottleneck | Solution |
|------------|----------|
| MongoDB | Atlas auto-scaling, indexes optimization |
| Redis | Upstash auto-scaling |
| Gemini API | BatchBuffer (gom 15 requests/call) |
| Concurrent users | ConcurrencyLimiter (max 10 AI calls) |
| Image upload | Cloudflare R2 (CDN, zero egress) |

## 8. Backup

```bash
# Manual backup
mongodump --uri="mongodb+srv://..." --out=./backup/$(date +%Y-%m-%d)

# Restore
mongorestore --uri="mongodb+srv://..." ./backup/2026-05-27
```

MongoDB Atlas tự động backup daily (retention 7 ngày free, 30 ngày paid).
