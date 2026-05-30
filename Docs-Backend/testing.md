# Testing Guide

## Stack
- **Vitest** ^4.x — test runner
- **V8** — code coverage (built-in)

## Running Tests
```bash
npm test                 # All tests
npm run test:watch       # Watch mode
npx vitest run --coverage  # With coverage
```

## Project Structure
```
src/tests/
├── setup.ts             # Global mocks + DB config
└── unit/
    ├── AuthService.test.ts
    ├── BrandService.test.ts
    ├── ProductService.test.ts
    ├── ImageService.test.ts
    └── MultiTenancy.test.ts
```

## Mocking Patterns

**Services (static classes):**
```ts
vi.mock('../../models/Brand.ts', () => ({
  Brand: { find: vi.fn(), create: vi.fn() }
}));
```

**Redis singleton:**
```ts
vi.mock('../config/redis.ts', () => ({
  redis: { get: vi.fn(), set: vi.fn(), setex: vi.fn(), del: vi.fn() }
}));
```

**AI Service:**
```ts
vi.mock('../services/AIService.ts', () => ({
  AIService: { generateResponse: vi.fn().mockResolvedValue('{}') }
}));
```

## Coverage Goals
| Layer | Target |
|-------|--------|
| Services | 80%+ |
| Middleware | 90%+ |
| Controllers | 60%+ |
| Utilities | 90%+ |

## What to Test
- CRUD operations, validation logic, cache patterns
- Error cases (not found, duplicate, validation)
- AI cascade fallback, JWT verification, RBAC, multi-tenancy
