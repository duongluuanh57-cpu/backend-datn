# Coding Standards

## General
- TypeScript strict mode, no `any`
- ES modules with `.ts` extension in imports
- Static class pattern (no instantiation) for controllers/services
- Clean architecture: Routes → Controllers → Services → Models

## Patterns

| Layer | Pattern | File |
|-------|---------|------|
| Routes | Async Fastify plugin | `product.routes.ts` |
| Controllers | Static class methods | `ProductController.ts` |
| Services | Static class methods | `ProductService.ts` |
| Models | Mongoose schema + interface | `Product.ts` |

## Error Handling
- `AppError` base class → `NotFoundError` (404), `ValidationError` (400), `UnauthorizedError` (401), `ConflictError` (409)
- 4-layer global error handler in `errorHandler.ts`

## Validation
- Zod schemas for all inputs (body, query, params)
- Type inference: `type T = z.infer<typeof Schema>`

## AI Patterns
- Cascade fallback: 3 models (flash-lite → 2.0-flash-lite → 1.5-flash-lite), 3 retries = 9 attempts max
- ConcurrencyLimiter: max 10 concurrent Gemini calls, queue 200
- BatchBuffer: 150ms window, 15 users max, 2s max wait

## Multi-tenancy
- Mongoose plugin auto-filters `tenantId` from JWT claims
- No `X-Tenant-ID` header needed

## Performance
- Use `.lean()` for read-only queries, `.select()` for field limiting
- Cache expensive queries in Redis (TTL 5-15 min)
- Use aggregation pipeline instead of `find({}).toArray()`
- Separate admin routes with nested Fastify plugins (`/admin` prefix)
