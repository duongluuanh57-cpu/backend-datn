# Project Structure

```
Backend-api/
├── .env / .env.example
├── package.json / tsconfig.json / vitest.config.ts
└── src/
    ├── app.ts            # Fastify app factory (buildApp)
    ├── server.ts         # Entry point (start server)
    ├── config/           # database.ts, redis.ts, sentry.ts, storage.ts
    ├── plugins/core.ts   # Fastify plugin — DI container
    ├── middleware/       # authMiddleware, errorHandler, qstashMiddleware
    ├── controllers/      # 22 HTTP controllers (Auth, Product, Order, AI, ...)
    ├── services/         # 28 business logic services (Auth, AI, Search, ...)
    ├── routes/           # 22 route files (auth, product, order, ai, ...)
    ├── models/           # 24 Mongoose schemas (User, Product, Order, ...)
    ├── types/            # Zod schemas + TypeScript types
    ├── utils/            # auth.ts, crypto.ts, errors.ts, multiTenancyPlugin.ts
    ├── repositories/     # UserRepository.ts
    ├── scripts/          # 15 migration/utility scripts
    └── tests/            # Vitest unit tests + setup.ts
```

## Architecture Layers

```
HTTP → Fastify App → Middleware → Routes → Controllers → Services → Models/DB
```

- **Layered Architecture** + **Static Class Pattern**
- Multi-tenancy via Mongoose plugin (auto `tenantId` filter from JWT)
- All responses: `{ success, data?, pagination?, message? }`
- Error handling: 4-layer (AppError → Fastify validation → 500 → process)
