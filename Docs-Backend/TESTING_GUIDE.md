# Testing Guide — Elite SaaS Backend

## 1. Test Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | ^4.x | Test runner |
| V8 | built-in | Code coverage |

## 2. Running Tests

```bash
# Chạy tất cả tests
npm test

# Watch mode (phát triển)
npm run test:watch

# Coverage report
npx vitest run --coverage
```

## 3. Project Structure

```
src/tests/
├── setup.ts              # Test setup (global mocks, DB connection)
└── unit/                 # Unit tests
    ├── AuthService.test.ts
    ├── BrandService.test.ts
    ├── ProductService.test.ts
    ├── ImageService.test.ts
    └── MultiTenancy.test.ts
```

## 4. Test Patterns

### Static Class Testing

Controllers và Services đều dùng static class methods, dễ test hơn vì không cần instance:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../../models/Brand.ts', () => ({
  Brand: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  }
}));

import { BrandService } from '../services/BrandService.ts';
import { Brand } from '../models/Brand.ts';

describe('BrandService', () => {
  it('should get paginated brands', async () => {
    const mockBrands = [{ name: 'Chanel' }, { name: 'Dior' }];
    (Brand.find as any).mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockBrands),
    });

    const result = await BrandService.getPaginatedBrands('tenant-1', { page: 1, limit: 10 });
    expect(result).toEqual(mockBrands);
  });
});
```

### Mocking Redis

```typescript
vi.mock('../config/redis.ts', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  }
}));
```

### Mocking AI Service

```typescript
vi.mock('../services/AIService.ts', () => ({
  AIService: {
    generateResponse: vi.fn().mockResolvedValue('{"name": "Test"}'),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0)),
  }
}));
```

## 5. What to Test

### Services (Business Logic)
- CRUD operations
- Validation logic (VoucherService.validate)
- Cache patterns (check cache → DB → set cache)
- Error cases (not found, duplicate, validation)
- AI cascade fallback

### Middleware
- JWT verification
- Role-based access (RBAC)
- Error handler (4 layers)

### Utilities
- JWT token generation/verification
- Crypto (AES-256-GCM)
- Multi-tenancy plugin (auto-filter)

## 6. Coverage Goals

| Layer | Target |
|-------|--------|
| Services | 80%+ |
| Middleware | 90%+ |
| Controllers | 60%+ (thin layer) |
| Utilities | 90%+ |

## 7. Test Commands

```bash
# Run with specific file
npx vitest run src/tests/unit/BrandService.test.ts

# Run with grep pattern
npx vitest run -t "should create brand"

# Update snapshots
npx vitest run --update
```
