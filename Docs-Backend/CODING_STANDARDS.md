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
| Controllers (single) | Static class methods | `ProductController.ts` |
| Controllers (split) | Barrel re-export + sub-controllers | `ProductController.ts` → `product/` |
| Services (single) | Static class methods | `ProductService.ts` |
| Services (split) | Barrel re-export + sub-services | `ProductService.ts` → `product/` |
| Models | Mongoose schema + Interface | `Product.ts` |
| Types | Zod schemas + TypeScript types | `product.types.ts` |
| Middleware | Async functions | `auth.middleware.ts` |
| Utils | Exported functions | `auth.ts` |

### Barrel File Pattern (Large Controllers/Services)

Khi controller/service quá lớn (≥~5KB), tách thành nhiều file con trong thư mục riêng:

```typescript
// controllers/ProductController.ts — Barrel file
export { ProductListingController } from './product/productListingController.ts';
export { ProductMutationController } from './product/productMutationController.ts';

// Backward-compatible class
import { ProductListingController } from './product/productListingController.ts';
import { ProductMutationController } from './product/productMutationController.ts';

export class ProductController {
  static getNewProducts = ProductListingController.getNewProducts;
  static getAllProducts = ProductListingController.getAllProducts;
  static createProduct = ProductMutationController.createProduct;
  // ...
}
```

**Quy tắc:**
- Routes vẫn import từ barrel file: `import { ProductController } from '../controllers/ProductController.ts'`
- Controller/Services files trong thư mục `{tên}/` với tên class + tên file
- Barrel file giữ nguyên tên và exports cũ → **zero breaking changes**

---

## AI Cascade Fallback Pattern (3 Models)

```typescript
// AIService implements cascade fallback with retry
// 3 model khác nhau, tăng dần độ resilience
const PRIMARY_MODEL = 'gemini-3.1-flash-lite';    // Model chính, nhanh nhất
const FALLBACK_MODEL = 'gemini-2.0-flash-lite';    // Fallback nhẹ hơn
const SECONDARY_FALLBACK_MODEL = 'gemini-1.5-flash-lite'; // Fallback cũ nhất

// Cascade loop: Model 1 → Model 2 → Model 3 → Retry cycle 2...
static async identifyProduct(image: string, prompt: string): Promise<string> {
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL];
  const maxRetries = 2;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      try {
        const release = await geminiLimiter.acquire(1); // Concurrency guard
        try {
          const result = await model.generateContent([prompt]);
          return result.response.text();
        } finally { release(); }
      } catch (error) {
        if (isRetryable(error)) continue; // Try next model
        throw error;
      }
    }
    retryCount++;
    await sleep(1000 * retryCount); // Exponential backoff
  }
  throw new Error('All AI models failed');
}
```

---

## BatchBuffer Pattern (Chat AI)

```typescript
// BatchBuffer — gom nhiều request vào 1 lần gọi Gemini
const response = await batchBuffer.push({
  question: lastMessage,
  cleanQuestion,
  cacheKey,
  context,
  storeOverview,
  adaptiveDirective,
  tenantId,
});
return reply.status(200).send({ response });

// Bên trong BatchBuffer:
// 1. Push vào queue, trả về Promise
// 2. Flush khi: 150ms timeout / 15 users / 2s max wait
// 3. Cache check trước (Redis + Knowledge DB)
// 4. Gọi AIService.createBatchChatStream(items) — 1 lần Gemini cho N câu hỏi
// 5. Parse JSON response, resolve từng Promise
// 6. Cache kết quả vào Redis + Knowledge DB

// Config:
const BATCH_WINDOW_MS = 150;
const MAX_BATCH_SIZE = 15;
const MAX_WAIT_MS = 2000;
```

## ConcurrencyLimiter Pattern

```typescript
// Global singleton — bảo vệ Gemini API khỏi quá tải
import { geminiLimiter } from './ConcurrencyLimiter.ts';

// Mọi Gemini call đều phải acquire/release
const release = await geminiLimiter.acquire(priority);
try {
  const result = await model.generateContent(prompt);
  return result;
} finally {
  release();
}

// Config: maxConcurrent = 10, maxQueueSize = 200
// queue tự động sort theo priority: higher priority → older first
```

## Rate Limiting Pattern

```typescript
// @fastify/rate-limit trong app.ts
app.register(rateLimit, {
  max: (request: any) => {
    const user = request.user;
    if (user?.role === 'ADMIN') return 5000;
    if (user?.role === 'SUBADMIN') return 2000;
    if (user?.role === 'USER') return 300;
    return 60; // Guest
  },
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    return request.user?._id?.toString() || request.ip;
  }
});
```

## Payment Service Pattern

```typescript
// PaymentService — CRUD + lifecycle management
export class PaymentService {
  static async create(data: { orderId, method, amount }, tenantId: string) {
    return Payment.create({ ...data, status: 'pending', tenantId });
  }

  static async markPaid(id, transactionCode, tenantId) {
    return Payment.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status: 'paid', transactionCode, paidAt: new Date() } },
      { new: true }
    );
  }

  static async markRefunded(id, tenantId) {
    return Payment.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status: 'refunded', refundedAt: new Date() } },
      { new: true }
    );
  }
}
```

## Voucher Service Pattern

```typescript
// VoucherService — validate + usage tracking
export class VoucherService {
  static async validate(code: string, orderAmount: number, tenantId: string) {
    const voucher = await Voucher.findOne({ code: code.toUpperCase(), tenantId });

    if (!voucher) return { valid: false, message: 'Mã không tồn tại' };
    if (voucher.status !== 'active') return { valid: false, message: 'Đã bị vô hiệu hoá' };
    if (voucher.startDate > now) return { valid: false, message: 'Chưa đến hạn' };
    if (voucher.endDate < now) return { valid: false, message: 'Đã hết hạn' };
    if (voucher.maxUsage > 0 && voucher.usedCount >= voucher.maxUsage) {
      return { valid: false, message: 'Đã hết lượt' };
    }
    if (orderAmount < voucher.minOrderAmount) {
      return { valid: false, message: `Đơn hàng tối thiểu ${voucher.minOrderAmount}đ` };
    }

    let discountAmount = voucher.type === 'percentage'
      ? Math.min(Math.round(orderAmount * voucher.value / 100), voucher.maxDiscount || Infinity)
      : voucher.value;

    return { valid: true, voucher, discountAmount };
  }
}
```

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

## Search with Aggregation Pipeline

⚠️ **Không dùng `find({}).toArray()` để search** — sẽ load toàn bộ collection vào RAM.

Thay vào đó, dùng `mongoose.connection.db.collection().aggregate([...])` để MongoDB xử lý filter/sort/limit ngay trong database:

```typescript
// ✅ Good: aggregate pipeline — MongoDB làm việc filter, $lookup brands, limit
const products = await mongoose.connection.db.collection('products').aggregate([
  { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brandData' } },
  { $unwind: { path: '$brandData', preserveNullAndEmptyArrays: true } },
  { $match: { $or: [{ name: { $regex: word, $options: 'i' } }, { 'brandData.name': { $regex: word, $options: 'i' } }] } },
  { $limit: limit + 4 },
  { $sort: { soldCount: -1, rating: -1 } },
  { $limit: limit },
  { $project: { _id: 1, name: 1, price: 1, brand: '$brandData.name' } },
]).toArray();
```

## Admin Route Nesting Pattern

⚠️ **Không đặt admin routes và param routes cùng cấp** — `/admin/orders` và `/:id` sẽ conflict.

Dùng Fastify nested plugin với prefix để tách biệt:

```typescript
// ✅ Good: admin routes tách riêng với prefix, không conflict với /:id
async function adminOrderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireRole('ADMIN', 'SUBADMIN'));
  app.get('/orders', OrderController.getAllOrdersForAdmin);
  app.get('/:id', OrderController.getOrderByIdForAdmin);
  app.patch('/:id/status', OrderController.updateOrderStatus);
  // ...
}

export async function orderRoutes(app: FastifyInstance) {
  app.get('/my-orders', { preHandler: [authMiddleware] }, OrderController.getMyOrders);
  app.get('/:id', { preHandler: [authMiddleware] }, OrderController.getOrderById);
  await app.register(adminOrderRoutes, { prefix: '/admin' }); // → /api/orders/admin/*
}
```

---

## Code Review Checklist

- [ ] TypeScript strict mode compliance
- [ ] All queries include `tenantId` filter (auto via plugin)
- [ ] Input validation with Zod
- [ ] Error handling with custom error classes
- [ ] Passwords hashed with bcrypt
- [ ] AI calls use cascade fallback (3 models, not 1)
- [ ] Gemini calls use concurrency limiter (acquire/release)
- [ ] Chat API uses BatchBuffer (not direct streaming for users)
- [ ] Cache expensive operations in Redis
- [ ] PostHog tracking for important user actions
- [ ] Structured logging (Pino), not console.log for production
- [ ] Imports have `.ts` extension (ESM)
- [ ] No `any` types
- [ ] Static class pattern (no instantiation)
- [ ] Null checks before accessing properties
- [ ] QStash jobs have idempotency check
- [ ] File upload goes through Sharp optimize → R2
