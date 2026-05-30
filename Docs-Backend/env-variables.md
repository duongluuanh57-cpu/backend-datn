# Environment Variables

## Server
| Var | Default | Description |
|-----|---------|-------------|
| `PORT` | 4000 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `NODE_ENV` | development | dev / production / test |
| `LOG_LEVEL` | info | trace / debug / info / warn / error |
| `APP_VERSION` | 1.0.0 | Version string |

## Database & Cache
| Var | Description |
|-----|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `REDIS_URL` | Redis (Upstash/Render/local) |

## AI & Security
| Var | Description |
|-----|-------------|
| `GEMINI_API_KEY` | Google AI API key |
| `JWT_SECRET` | HS256 secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) |
| `ENCRYPTION_KEY` | AES-256-GCM for 2FA secrets |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `FRONTEND_URL` | Frontend base URL |

## Cloudflare R2
| Var | Description |
|-----|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | R2 account |
| `R2_ACCESS_KEY_ID` | S3 access key |
| `R2_SECRET_ACCESS_KEY` | S3 secret |
| `R2_BUCKET_NAME` | Bucket name |
| `R2_PUBLIC_URL` | CDN domain |

## QStash
| Var | Description |
|-----|-------------|
| `QSTASH_TOKEN` | API token |
| `QSTASH_CURRENT_SIGNING_KEY` | Webhook verification |
| `QSTASH_NEXT_SIGNING_KEY` | Key rotation |
| `APP_WEBHOOK_URL` | Base URL for QStash callbacks |

## SMTP / OAuth / Monitoring / GitHub
| Var | Description |
|-----|-------------|
| `SMTP_HOST/PORT/USER/PASS` | Gmail SMTP config |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| `SENTRY_DSN` | Error tracking |
| `POSTHOG_KEY` | Product analytics |
| `GITHUB_REPO_OWNER/NAME/BRANCH` | DocsService |
| `REGION`, `SECONDARY_REGION_URL` | Failover config |
