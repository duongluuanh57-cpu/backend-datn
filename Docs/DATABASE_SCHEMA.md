# Database Schema - Elite SaaS Backend

## Database: MongoDB Atlas

## Collections Overview

```
├── users              # User accounts and authentication
├── tenants            # Multi-tenant organizations
├── products           # Product catalog
├── orders             # Customer orders
├── orderItems         # Order line items
├── knowledgeBases     # AI knowledge base documents
├── sessions           # User sessions (optional)
└── auditLogs          # Audit trail (optional)
```

## Schema Definitions

### Users Collection

```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,              // Reference to tenant
  email: string,                   // Unique per tenant
  password: string,                // Bcrypt hashed
  name: string,
  role: 'admin' | 'user' | 'guest',
  
  // OAuth
  googleId?: string,
  
  // 2FA
  twoFactorEnabled: boolean,
  twoFactorSecret?: string,
  
  // Profile
  avatar?: string,
  phone?: string,
  
  // Status
  isActive: boolean,
  isEmailVerified: boolean,
  emailVerificationToken?: string,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt?: Date
}
```

**Indexes:**
```javascript
{ tenantId: 1, email: 1 }  // Unique compound index
{ googleId: 1 }            // For OAuth lookup
{ emailVerificationToken: 1 }
```

**Mongoose Schema:**
```typescript
const UserSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user', 'guest'], default: 'user' },
  googleId: { type: String, sparse: true },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  avatar: { type: String },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  lastLoginAt: { type: Date }
}, {
  timestamps: true
});

// Compound unique index
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
```

---

### Tenants Collection

```typescript
{
  _id: ObjectId,
  name: string,                    // Organization name
  slug: string,                    // URL-friendly identifier (unique)
  
  // Subscription
  plan: 'free' | 'pro' | 'enterprise',
  subscriptionStatus: 'active' | 'cancelled' | 'expired',
  subscriptionExpiresAt?: Date,
  
  // Limits
  maxUsers: number,
  maxProducts: number,
  maxStorage: number,              // In bytes
  
  // Settings
  settings: {
    currency: string,              // USD, EUR, VND
    timezone: string,
    language: string
  },
  
  // Contact
  contactEmail: string,
  contactPhone?: string,
  
  // Status
  isActive: boolean,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ slug: 1 }  // Unique
```

---

### Products Collection

```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,              // Multi-tenancy
  
  // Basic Info
  name: string,
  slug: string,                    // URL-friendly (unique per tenant)
  description: string,
  
  // Pricing
  price: number,
  compareAtPrice?: number,         // Original price (for discounts)
  cost?: number,                   // Cost price (for profit calculation)
  
  // Inventory
  sku?: string,
  barcode?: string,
  stock: number,
  trackInventory: boolean,
  
  // Media
  images: string[],                // URLs to R2/CDN
  thumbnail?: string,
  
  // Categorization
  category: string,
  tags: string[],
  
  // AI/Search
  embedding?: number[],            // Gemini Embedding (3072 dims)
  embeddingHash?: string,          // MD5 hash for delta indexing
  
  // Taxonomies (for AI classification)
  taxonomies?: {
    category?: string,
    subcategory?: string,
    attributes?: Record<string, any>
  },
  
  // SEO
  metaTitle?: string,
  metaDescription?: string,
  
  // Status
  status: 'draft' | 'active' | 'archived',
  isPublished: boolean,
  publishedAt?: Date,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ tenantId: 1, slug: 1 }           // Unique compound
{ tenantId: 1, status: 1 }         // For filtering
{ tenantId: 1, category: 1 }
{ tenantId: 1, createdAt: -1 }     // For sorting
{ sku: 1 }                         // For lookup
{ 'taxonomies.category': 1 }       // For AI search
```

**Virtual Fields:**
```typescript
// Profit margin
productSchema.virtual('profitMargin').get(function() {
  if (!this.cost) return null;
  return ((this.price - this.cost) / this.price) * 100;
});

// Discount percentage
productSchema.virtual('discountPercent').get(function() {
  if (!this.compareAtPrice) return 0;
  return ((this.compareAtPrice - this.price) / this.compareAtPrice) * 100;
});
```

---

### Orders Collection

```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,
  
  // Order Info
  orderNumber: string,             // Unique, human-readable (e.g., "ORD-2026-001")
  
  // Customer
  customerId?: ObjectId,           // Reference to User (optional for guest checkout)
  customerEmail: string,
  customerName: string,
  customerPhone?: string,
  
  // Items (embedded or referenced)
  items: [
    {
      productId: ObjectId,
      productName: string,         // Snapshot at order time
      quantity: number,
      price: number,               // Price at order time
      total: number                // quantity * price
    }
  ],
  
  // Pricing
  subtotal: number,
  tax: number,
  shipping: number,
  discount: number,
  total: number,
  
  // Shipping Address
  shippingAddress: {
    fullName: string,
    address: string,
    city: string,
    state: string,
    postalCode: string,
    country: string
  },
  
  // Payment
  paymentMethod: 'card' | 'cash' | 'bank_transfer',
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded',
  paidAt?: Date,
  
  // Fulfillment
  fulfillmentStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
  shippedAt?: Date,
  deliveredAt?: Date,
  trackingNumber?: string,
  
  // Notes
  customerNote?: string,
  internalNote?: string,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ tenantId: 1, orderNumber: 1 }    // Unique compound
{ tenantId: 1, customerId: 1 }
{ tenantId: 1, paymentStatus: 1 }
{ tenantId: 1, fulfillmentStatus: 1 }
{ tenantId: 1, createdAt: -1 }     // For sorting
```

---

### KnowledgeBases Collection (AI/RAG)

```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,
  
  // Content
  title: string,
  content: string,                 // Original text
  contentHash: string,             // MD5 hash for delta indexing
  
  // Chunking (for large documents)
  chunks: [
    {
      text: string,
      embedding: number[],         // Gemini Embedding (3072 dims)
      startIndex: number,
      endIndex: number
    }
  ],
  
  // Metadata
  source: 'manual' | 'upload' | 'scrape' | 'api',
  sourceUrl?: string,
  category?: string,
  tags: string[],
  
  // AI Processing
  lastIndexedAt?: Date,
  indexingStatus: 'pending' | 'processing' | 'completed' | 'failed',
  
  // Status
  isActive: boolean,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ tenantId: 1, isActive: 1 }
{ tenantId: 1, category: 1 }
{ contentHash: 1 }                 // For delta indexing
```

---

## Relationships

```
Tenant (1) ──< (N) Users
Tenant (1) ──< (N) Products
Tenant (1) ──< (N) Orders
Tenant (1) ──< (N) KnowledgeBases

User (1) ──< (N) Orders (as customer)

Order (1) ──< (N) OrderItems
Product (1) ──< (N) OrderItems
```

## Multi-tenancy Strategy

**Logical Isolation** - All collections include `tenantId` field

```typescript
// Every query MUST include tenantId filter
const products = await Product.find({
  tenantId: req.tenantId,  // Always required
  status: 'active'
});
```

**Benefits:**
- Single database for all tenants
- Cost-effective
- Easy to manage
- Good performance with proper indexes

**Security:**
- Middleware enforces tenant context
- Repository layer adds tenant filter automatically
- No cross-tenant data access possible

## Indexes Strategy

### Compound Indexes
```javascript
// Multi-tenancy + unique field
{ tenantId: 1, email: 1 }
{ tenantId: 1, slug: 1 }
{ tenantId: 1, orderNumber: 1 }

// Multi-tenancy + filter field
{ tenantId: 1, status: 1 }
{ tenantId: 1, category: 1 }

// Multi-tenancy + sort field
{ tenantId: 1, createdAt: -1 }
{ tenantId: 1, price: 1 }
```

### Text Indexes (for search)
```javascript
// Full-text search
Product.index({
  name: 'text',
  description: 'text',
  tags: 'text'
}, {
  weights: {
    name: 10,
    tags: 5,
    description: 1
  }
});
```

## Data Migration Scripts

### Add Tenant ID to Existing Data
```typescript
// scripts/add-tenant-id.ts
const defaultTenantId = new ObjectId('...');

await Product.updateMany(
  { tenantId: { $exists: false } },
  { $set: { tenantId: defaultTenantId } }
);
```

### Migrate Product Images to R2
```typescript
// scripts/migrate-product-images.ts
const products = await Product.find({ images: { $exists: true } });

for (const product of products) {
  const optimizedImages = await mediaService.optimizeAndUpload(product.images);
  await Product.updateOne(
    { _id: product._id },
    { $set: { images: optimizedImages } }
  );
}
```

## Backup Strategy

**Automated Backups:**
- MongoDB Atlas: Daily automated backups
- Retention: 7 days for free tier, 30 days for paid

**Manual Backups:**
```bash
# Export collection
mongodump --uri="mongodb+srv://..." --collection=products --out=./backup

# Import collection
mongorestore --uri="mongodb+srv://..." --collection=products ./backup/products.bson
```

## Performance Optimization

### Query Optimization
```typescript
// ✅ Good: Use indexes, lean queries
const products = await Product
  .find({ tenantId, status: 'active' })
  .select('name price images')  // Only needed fields
  .sort('-createdAt')
  .limit(20)
  .lean();  // Plain JS objects, 5x faster

// ❌ Bad: No optimization
const products = await Product.find({ tenantId });
```

### Aggregation Pipeline
```typescript
// Get order statistics
const stats = await Order.aggregate([
  { $match: { tenantId: new ObjectId(tenantId) } },
  { $group: {
    _id: '$paymentStatus',
    count: { $sum: 1 },
    total: { $sum: '$total' }
  }}
]);
```

## Related Documentation

- [Project Structure](./PROJECT_STRUCTURE.md)
- [Tech Stack](./TECH_STACK.md)
- [API Conventions](./API_CONVENTIONS.md)
- [Coding Standards](./CODING_STANDARDS.md)
- [Environment Variables](./ENV_VARIABLES.md)
