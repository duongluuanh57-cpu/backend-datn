# Coding Standards - Elite SaaS Backend

## General Principles

1. **Type Safety First** - Full TypeScript strict mode, no `any` types
2. **Multi-tenancy Always** - Every query must include `tenantId` filter
3. **Security by Default** - Validate all inputs, sanitize outputs
4. **Performance Matters** - Cache aggressively, optimize queries
5. **Observability** - Log everything, monitor errors
6. **Testability** - Write testable code, dependency injection
7. **Clean Code** - Self-documenting, consistent naming

## TypeScript Standards

### Strict Mode Configuration

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Type Definitions

**DO:**
```typescript
// Explicit return types for functions
function calculateTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Interface for object shapes
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// Type for unions
type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

// Const assertions for literal types
const ROLES = ['admin', 'user', 'guest'] as const;
type Role = typeof ROLES[number];
```

**DON'T:**
```typescript
// ❌ Implicit any
function process(data) {
  return data.value;
}

// ❌ Using any
function handle(req: any) {
  return req.body;
}

// ❌ Non-null assertion without check
const user = users.find(u => u.id === id)!;
```

### Null Safety

```typescript
// DO: Check for null/undefined
const user = await userRepository.findById(id);
if (!user) {
  throw new NotFoundError('User not found');
}
return user;

// DO: Use optional chaining
const email = user?.profile?.email;

// DO: Use nullish coalescing
const limit = query.limit ?? 20;

// DON'T: Assume values exist
const email = user.profile.email; // ❌ Can crash
```

## Architecture Patterns

### Layered Architecture

**Controller Layer:**
```typescript
// ✅ Good: Thin controller, delegates to service
export class ProductController {
  constructor(private productService: ProductService) {}

  async createProduct(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenantId; // From middleware
    const data = req.body as CreateProductDTO;
    
    const product = await this.productService.createProduct(tenantId, data);
    
    return reply.code(201).send({
      success: true,
      data: product
    });
  }
}

// ❌ Bad: Business logic in controller
export class ProductController {
  async createProduct(req: FastifyRequest, reply: FastifyReply) {
    // ❌ Don't do validation here
    if (!req.body.name || req.body.price < 0) {
      return reply.code(400).send({ error: 'Invalid data' });
    }
    
    // ❌ Don't access database directly
    const product = await Product.create({
      ...req.body,
      tenantId: req.tenantId
    });
    
    return reply.send(product);
  }
}
```

**Service Layer:**
```typescript
// ✅ Good: Business logic in service
export class ProductService {
  constructor(
    private productRepo: ProductRepository,
    private mediaService: MediaService,
    private cacheService: CacheService
  ) {}

  async createProduct(tenantId: string, data: CreateProductDTO): Promise<Product> {
    // Validate business rules
    if (data.price < 0) {
      throw new ValidationError('Price must be positive');
    }

    // Process images
    const optimizedImages = await this.mediaService.optimizeImages(data.images);

    // Create product
    const product = await this.productRepo.create({
      ...data,
      tenantId,
      images: optimizedImages
    });

    // Invalidate cache
    await this.cacheService.invalidate(`products:${tenantId}:*`);

    return product;
  }
}

// ❌ Bad: No business logic
export class ProductService {
  async createProduct(data: any) {
    return await Product.create(data); // ❌ Just passing through
  }
}
```

**Repository Layer:**
```typescript
// ✅ Good: Data access only
export class ProductRepository {
  constructor(private db: typeof Product) {}

  async create(data: CreateProductData): Promise<Product> {
    return await this.db.create(data);
  }

  async findById(id: string, tenantId: string): Promise<Product | null> {
    return await this.db.findOne({ _id: id, tenantId });
  }

  async findByTenant(tenantId: string, options: QueryOptions): Promise<Product[]> {
    const { page = 1, limit = 20, sort = '-createdAt' } = options;
    
    return await this.db
      .find({ tenantId })
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  }
}

// ❌ Bad: Business logic in repository
export class ProductRepository {
  async create(data: any) {
    // ❌ Don't validate here
    if (data.price < 0) throw new Error('Invalid price');
    
    // ❌ Don't process images here
    data.images = await optimizeImages(data.images);
    
    return await this.db.create(data);
  }
}
```

## Multi-tenancy Standards

### Always Filter by Tenant

```typescript
// ✅ Good: Tenant filter in all queries
async findProducts(tenantId: string, filters: ProductFilters) {
  return await Product.find({
    tenantId, // Always include
    ...filters
  });
}

// ❌ Bad: Missing tenant filter
async findProducts(filters: ProductFilters) {
  return await Product.find(filters); // ❌ Can access other tenants' data
}
```

### Tenant Middleware

```typescript
// ✅ Good: Extract tenant from header
export const tenantMiddleware = async (req: FastifyRequest, reply: FastifyReply) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  
  if (!tenantId) {
    throw new UnauthorizedError('Tenant ID required');
  }
  
  // Verify user belongs to tenant
  if (req.user.tenantId !== tenantId) {
    throw new ForbiddenError('Access denied');
  }
  
  req.tenantId = tenantId;
};
```

## Error Handling

### Custom Error Classes

```typescript
// ✅ Good: Specific error classes
export class ValidationError extends Error {
  constructor(message: string, public details?: any[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Usage
if (!user) {
  throw new NotFoundError('User not found');
}
```

### Global Error Handler

```typescript
// ✅ Good: Centralized error handling
export const errorHandler = (error: Error, req: FastifyRequest, reply: FastifyReply) => {
  // Log error
  req.log.error({
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  // Send appropriate response
  if (error instanceof ValidationError) {
    return reply.code(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details
      }
    });
  }

  if (error instanceof NotFoundError) {
    return reply.code(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: error.message
      }
    });
  }

  // Default error
  return reply.code(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
};
```

## Validation Standards

### Zod Schemas

```typescript
// ✅ Good: Reusable schemas
export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  category: z.enum(['electronics', 'clothing', 'food']),
  stock: z.number().int().nonnegative(),
  images: z.array(z.string().url()).max(10)
});

export type CreateProductDTO = z.infer<typeof CreateProductSchema>;

// Usage in route
app.post('/products', {
  schema: {
    body: CreateProductSchema
  }
}, async (req, reply) => {
  // req.body is now typed and validated
  const product = await productService.createProduct(req.tenantId, req.body);
  return reply.code(201).send({ success: true, data: product });
});
```

## Security Standards

### Input Sanitization

```typescript
// ✅ Good: Sanitize user input
import { escapeHtml } from '../utils/sanitize.js';

async createPost(data: CreatePostDTO) {
  const sanitized = {
    title: escapeHtml(data.title),
    content: escapeHtml(data.content),
    authorId: data.authorId
  };
  
  return await this.postRepo.create(sanitized);
}
```

### Password Hashing

```typescript
// ✅ Good: Hash passwords before storing
import bcrypt from 'bcryptjs';

async createUser(data: CreateUserDTO) {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  
  return await this.userRepo.create({
    ...data,
    password: hashedPassword
  });
}

// ❌ Bad: Storing plain text passwords
async createUser(data: CreateUserDTO) {
  return await this.userRepo.create(data); // ❌ Password not hashed
}
```

### JWT Handling

```typescript
// ✅ Good: Short-lived access tokens
export const generateTokens = (userId: string, tenantId: string) => {
  const accessToken = jwt.sign(
    { userId, tenantId },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' } // Short-lived
  );
  
  const refreshToken = jwt.sign(
    { userId, tenantId, type: 'refresh' },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};
```

## Performance Standards

### Database Queries

```typescript
// ✅ Good: Use indexes, lean queries
async findProducts(tenantId: string, options: QueryOptions) {
  return await Product
    .find({ tenantId, status: 'active' })
    .select('name price images') // Only needed fields
    .sort('-createdAt')
    .limit(20)
    .lean(); // Plain JS objects, faster
}

// ❌ Bad: No optimization
async findProducts(tenantId: string) {
  return await Product.find({ tenantId }); // ❌ Returns all fields, all documents
}
```

### Caching

```typescript
// ✅ Good: Cache expensive operations
async getProductById(id: string, tenantId: string): Promise<Product> {
  const cacheKey = `product:${tenantId}:${id}`;
  
  // Try cache first
  const cached = await this.cache.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Fetch from database
  const product = await this.productRepo.findById(id, tenantId);
  if (!product) throw new NotFoundError('Product not found');
  
  // Cache for 5 minutes
  await this.cache.set(cacheKey, JSON.stringify(product), 300);
  
  return product;
}
```

### Batch Operations

```typescript
// ✅ Good: Batch database operations
async createProducts(tenantId: string, products: CreateProductDTO[]) {
  const docs = products.map(p => ({ ...p, tenantId }));
  return await Product.insertMany(docs); // Single query
}

// ❌ Bad: Multiple queries
async createProducts(tenantId: string, products: CreateProductDTO[]) {
  const results = [];
  for (const product of products) {
    results.push(await Product.create({ ...product, tenantId })); // ❌ N queries
  }
  return results;
}
```

## Logging Standards

```typescript
// ✅ Good: Structured logging
req.log.info({
  action: 'product.created',
  productId: product.id,
  tenantId: req.tenantId,
  userId: req.user.id,
  duration: Date.now() - startTime
});

// ❌ Bad: Unstructured logging
console.log('Product created:', product.id); // ❌ Hard to parse
```

## Testing Standards

```typescript
// ✅ Good: Unit test with mocks
describe('ProductService', () => {
  let service: ProductService;
  let mockRepo: jest.Mocked<ProductRepository>;
  
  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn()
    } as any;
    
    service = new ProductService(mockRepo);
  });
  
  it('should create product', async () => {
    const data = { name: 'Test', price: 100 };
    mockRepo.create.mockResolvedValue({ id: '123', ...data } as any);
    
    const result = await service.createProduct('tenant1', data);
    
    expect(result.id).toBe('123');
    expect(mockRepo.create).toHaveBeenCalledWith({
      ...data,
      tenantId: 'tenant1'
    });
  });
});
```

## File Naming Conventions

```
controllers/  → product.controller.ts
services/     → product.service.ts
repositories/ → product.repository.ts
models/       → Product.ts (PascalCase)
types/        → product.types.ts
middleware/   → auth.middleware.ts
utils/        → jwt.ts
tests/        → product.service.test.ts
```

## Import Conventions

```typescript
// ✅ Good: Organized imports with .js extension
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { ProductService } from '../services/product.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

import type { CreateProductDTO } from '../types/product.types.js';

import { Product } from '../models/Product.js';

// ❌ Bad: Missing .js extension (ESM requirement)
import { ProductService } from '../services/product.service'; // ❌
```

## Code Review Checklist

- [ ] TypeScript strict mode compliance
- [ ] All queries include `tenantId` filter
- [ ] Input validation with Zod
- [ ] Error handling with custom error classes
- [ ] Passwords hashed with bcrypt
- [ ] Sensitive data not logged
- [ ] Database queries optimized (indexes, lean, select)
- [ ] Caching for expensive operations
- [ ] Structured logging with Pino
- [ ] Unit tests for business logic
- [ ] No `any` types
- [ ] Imports have `.js` extension
- [ ] Functions have explicit return types
- [ ] Null checks before accessing properties

## Related Documentation

- [Project Structure](./PROJECT_STRUCTURE.md)
- [Tech Stack](./TECH_STACK.md)
- [API Conventions](./API_CONVENTIONS.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Environment Variables](./ENV_VARIABLES.md)
