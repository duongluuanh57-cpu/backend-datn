# Coding Standards — Elite SaaS Backend

## General Principles

1. **Type Safety** — Full TypeScript strict mode, no `any`
2. **Multi-tenancy** — Every query must include `tenantId` filter (auto via plugin)
3. **Security by Default** — Validate all inputs (Zod), sanitize outputs
4. **Performance** — Cache aggressively (Redis), optimize queries (lean, select)
5. **Observability** — Structured logging (Pino), track errors (Sentry), analytics (PostHog)
6. **AI-Native** — Auto-embedding on product save, semantic search, RAG

---

## Architecture Patterns

### Static Class Pattern (Controllers + Services)

Controllers và Services đều dùng **Static Class Methods** (không instantiation):

```typescript
// ✅ Good: Static class
export class ProductService {
  static async createProduct(tenantId: string, data: CreateProductDTO): Promise<Product> {
    const product = await Product.create({ ...data, tenantId });
    await RedisService.invalidate(`products:${tenantId}:*`);
    return product;
  }
}

// Usage: ProductService.createProduct(tenantId, data)
```

```typescript
// ✅ Good: Controller (thin layer)
export class ProductController {
  static async createProduct(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.user!.userId; // From JWT middleware
    const data = req.body as CreateProductDTO;
    const product = await ProductService.createProduct(tenantId, data);
    return reply.code(201).send({ success: true, data: product });
  }
}
```

### Route Definition — Fastify Plugin

```typescript
export async function productRoutes(app: FastifyInstance) {
  // Public
  app.get('/', ProductController.getAllProducts);
  app.get('/:id', ProductController.getProductById);

  // Protected
  app.post('/', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ProductController.createProduct);
  app.patch('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ProductController.updateProduct);
  app.delete('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ProductController.deleteProduct);
}
```

### Pattern Summary

| Layer | Pattern | File Naming |
|-------|---------|-------------|
| Routes | Async function, Fastify plugin | `product.routes.ts` |
| Controllers | Static class methods | `ProductController.ts` |
| Services | Static class methods | `ProductService.ts` |
| Models | Mongoose schema + Interface | `Product.ts` |
| Types | Zod schemas + TypeScript types | `product.types.ts` |
| Middleware | Async functions | `auth.middleware.ts` |
| Utils | Exported functions | `auth.ts` |

---

## AI Cascade Fallback Pattern

```typescript
// AIService implements cascade fallback with retry
static async identifyProduct(imageBuffer: Buffer): Promise<string> {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'];
  const maxRetries = 3;

  for (let cycle = 0; cycle < maxRetries; cycle++) {
    for (const modelName of models) {
      try {
        const result = await this.callGemini(modelName, imageBuffer);
        return result; // Success → return immediately
      } catch (error) {
        if (isRetryable(error)) {
          await sleep(exponentialBackoff(cycle, attempt));
          continue; // Retry with next model
        }
        throw error; // Non-retryable → propagate
      }
    }
  }
  throw new Error('All AI models failed after 9 attempts');
}
```

---

## Redis Caching Pattern

```typescript
export class ProductService {
  static async getTrendingProducts(tenantId: string) {
    const cacheKey = `products:${tenantId}:trending`;

    // 1. Try cache
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. Fetch from DB
    const products = await Product.find({ tenantId })
      .populate('brandId')
      .lean();

    // 3. Set cache (TTL)
    await redis.setex(cacheKey, 300, JSON.stringify(products));

    return products;
  }

  static async clearProductCache(tenantId: string) {
    const keys = await redis.keys(`products:${tenantId}:*`);
    if (keys.length > 0) await redis.del(...keys);
  }
}
```

---

## QStash Job Pattern

```typescript
// Controller — handler cho QStash job
export class JobController {
  static async handleWelcomeEmail(req: FastifyRequest, reply: FastifyReply) {
    const { email, name } = req.body as any;
    // QStash middleware đã verify signature + check idempotency
    await EmailService.sendWelcomeEmail(email, name);
    return reply.send({ success: true });
  }
}

// Service — publish job
export class AuthService {
  static async register(data: RegisterInput) {
    const user = await UserRepository.create({ ...data, tenantId });
    // Queue welcome email (5s delay)
    await QStashService.publish('/api/jobs/welcome-email', {
      email: user.email,
      name: user.username
    }, 5);
    return user;
  }
}
```

---

## PostHog Tracking Pattern

```typescript
// Track important user actions
export class AuthService {
  static async login(email: string, password: string) {
    const user = await UserRepository.findByEmail(email);
    // ... authentication logic ...

    PostHogService.capture(user._id.toString(), 'user_login', {
      email: user.email,
      method: 'password',
    });
    return tokens;
  }
}
```

---

## Error Handling Pattern

### Custom Error Classes
```typescript
// Định nghĩa trong utils/errors.ts
export class AppError extends Error {
  constructor(message: string, public statusCode: number) { super(message); }
}

// Usage
if (!user) throw new NotFoundError('User not found');
if (data.price < 0) throw new ValidationError('Price must be positive');
if (!req.user) throw new UnauthorizedError('Please login');
```

### Global Error Handler
4-layer processing trong `errorHandler.ts`:
1. `AppError` → Trả về statusCode tương ứng
2. Fastify validation error → 400
3. Unhandled error → 500 + Sentry capture
4. `unhandledRejection` / `uncaughtException` → Sentry + exit

---

## Validation (Zod) Pattern

```typescript
// Định nghĩa schema
export const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

// Type inference
export type RegisterInput = z.infer<typeof RegisterSchema>;

// Route-level validation
server.post('/register', {
  schema: { body: RegisterSchema },
  // config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
}, handler);
```

---

## ESM Import Conventions

```typescript
// Imports với .ts extension (ESM requirement)
import { AuthService } from '../services/AuthService.ts';
import { Product } from '../models/Product.ts';
import type { CreateProductDTO } from '../types/product.types.ts';
```

---

## File Naming Conventions

```
controllers/  → ProductController.ts      (PascalCase + Controller)
services/     → ProductService.ts         (PascalCase + Service)
models/       → Product.ts                (PascalCase)
routes/       → product.routes.ts          (kebab-case + .routes)
middleware/   → auth.middleware.ts         (kebab-case + .middleware)
types/        → product.types.ts           (kebab-case + .types)
utils/        → auth.ts                    (kebab-case)
scripts/      → migrate-products.ts        (kebab-case)
tests/        → ProductService.test.ts     (PascalCase + .test)
```

---

## Performance Standards

```typescript
// ✅ Use lean() for read-only (5x faster)
const products = await Product.find({ tenantId }).lean();

// ✅ Select only needed fields
.select('name price images');

// ✅ Use compound indexes
{ tenantId: 1, status: 1 }

// ✅ Batch operations
await Product.insertMany(docs);       // Single query
await Order.aggregate([...]);         // Aggregation pipeline

// ✅ Cache expensive queries
const cached = await redis.get(key);
if (cached) return JSON.parse(cached);
```

---

## Code Review Checklist

- [ ] TypeScript strict mode compliance
- [ ] All queries include `tenantId` filter (auto via plugin)
- [ ] Input validation with Zod
- [ ] Error handling with custom error classes
- [ ] Passwords hashed with bcrypt
- [ ] AI calls use cascade fallback (not direct)
- [ ] Cache expensive operations in Redis
- [ ] PostHog tracking for important user actions
- [ ] Structured logging (Pino), not console.log for production
- [ ] Imports have `.ts` extension (ESM)
- [ ] No `any` types
- [ ] Static class pattern (no instantiation)
- [ ] Null checks before accessing properties
- [ ] QStash jobs have idempotency check
- [ ] File upload goes through Sharp optimize → R2
