# Database Schema — Elite SaaS Backend

## Database: MongoDB Atlas

**Database Engine**: MongoDB (via Mongoose ODM v9)
**Connection**: `MONGO_URI` environment variable
**Multi-tenancy**: Logical isolation via `tenantId` field trên tất cả collections

---

## Collections Overview (18 collections)

```
users                   # Tài khoản người dùng (auth, OAuth, 2FA, roles)
user_addresses          # Địa chỉ giao hàng của user
brands                  # Thương hiệu sản phẩm
tags                    # Tags (nhãn) cho sản phẩm
products                # Sản phẩm chính (catalog)
product_variants        # Biến thể sản phẩm (size, price, stock)
product_images          # Hình ảnh sản phẩm (URLs)
product_seo             # SEO metadata + Vector embeddings (AI search)
product_tags            # Bảng trung gian Product ↔ Tag (nhiều-nhiều)
product_taxonomies      # Bảng trung gian Product ↔ Taxonomy (v1)
product_taxonomy_terms  # Bảng trung gian Product ↔ TaxonomyTerm (v2)
taxonomies              # Loại phân loại (cha): Scent Group, Concentration, Segment
taxonomy_terms          # Giá trị phân loại (con)
segments                # LEGACY: Phân khúc (thay bằng taxonomy)
scent_groups            # LEGACY: Nhóm hương (thay bằng taxonomy)
concentrations          # LEGACY: Nồng độ (thay bằng taxonomy)
orders                  # Đơn hàng
order_items             # Chi tiết đơn hàng (line items)
homepage_configs        # Cấu hình trang chủ (banner, sections, gallery)
contents                # Nội dung tĩnh (blog posts, pages)
knowledge               # Knowledge base cho AI RAG
audit_logs              # Audit trail cho bảo mật
```

---

## Schema Definitions

### 1. Users (`users`)

```typescript
{
  _id: ObjectId,
  username: string,              // Unique, indexed
  email: string,                 // Unique, indexed
  passwordHash: string,          // Bcrypt hashed (optional for OAuth users)
  role: 'USER' | 'ADMIN' | 'SUBADMIN',
  memberTier: 'MEMBER' | 'VIP' | 'ELITE MEMBER',
  tenantId: string,              // Multi-tenancy
  status: 'active' | 'inactive' | 'suspended',

  // 2FA
  twoFactorSecret?: string,
  twoFactorEnabled: boolean,

  // Profile
  fullName?: string,
  phoneNumber?: string,
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | '',
  address?: string,
  province?: string,
  district?: string,
  avatar?: string,

  // OAuth
  oauthProvider?: 'google' | 'github',
  oauthId?: string,

  // Timestamps (auto)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ username: 1 }` — unique
- `{ email: 1 }` — unique
- `{ tenantId: 1 }` — multi-tenancy filter
- `{ status: 1 }` — filter active users
- `{ oauthProvider: 1, oauthId: 1 }` — OAuth lookup

---

### 2. User Addresses (`user_addresses`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  userId: ObjectId,              // Reference to User
  fullName: string,
  phone: string,
  street: string,
  ward?: string,
  district: string,
  province: string,
  country: string,
  isDefault: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ userId: 1 }`, `{ tenantId: 1 }`

---

### 3. Brands (`brands`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  name: string,                  // Indexed
  logo?: string,                 // URL
  description?: string,
  origin?: string,               // Country of origin
  status: 'active' | 'inactive',
  featured: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ tenantId: 1, name: 1 }`

---

### 4. Tags (`tags`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  name: string,                  // Indexed
  slug: string,                  // Indexed (URL-friendly)
  status: 'active' | 'inactive',
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ tenantId: 1, slug: 1 }` — unique

---

### 5. Products (`products`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  name: string,                  // Indexed
  brandId: ObjectId,             // Reference to Brand
  price: number,                 // Base price (lowest variant price)
  description: string,
  variants: ObjectId[],          // References to ProductVariant
  gender?: string,               // 'male' | 'female' | 'unisex'
  rating: number,                // Default: 5
  reviewsCount: number,          // Default: 0
  quantityInStock: number,       // Total stock (from variants)
  discountPercentage: number,    // Default: 0
  discountStartDate?: Date,
  discountEndDate?: Date,
  soldCount: number,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ tenantId: 1, name: 1 }` — search
- `{ tenantId: 1, brandId: 1 }` — filter by brand
- `{ tenantId: 1, price: 1 }` — sort by price

**Hooks:**
- `post('save')` — Tự động gọi `AIService.generateEmbedding()` để tạo vector embedding (3072 dimensions), lưu vào `ProductSEO`

---

### 6. Product Variants (`product_variants`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  productId: ObjectId,           // Reference to Product
  size: string,                  // '30ml', '50ml', '100ml'
  price: number,
  quantityInStock: number,
  sku?: string,                  // Stock Keeping Unit
  isDefault: boolean,            // Default variant
  sortOrder: number,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ productId: 1 }`, `{ tenantId: 1, productId: 1 }`

---

### 7. Product Images (`product_images`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  productId: ObjectId,           // Reference to Product
  url: string,                   // Image URL (Cloudflare R2)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ productId: 1 }`

---

### 8. Product SEO (`product_seo`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  productId?: ObjectId,          // Reference to Product
  metaTitle?: string,
  metaDescription?: string,
  keywords?: string[],
  slug?: string,                 // URL-friendly, indexed
  ogTitle?: string,
  ogDescription?: string,
  ogImage?: string,
  canonicalUrl?: string,
  embedding?: number[],          // Gemini Embedding 2 (3072 dimensions)
  priceReport?: string,          // AI price analysis
  sizeReport?: string,           // AI size recommendation
  discountReport?: string,       // AI discount strategy
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ productId: 1 }`, `{ slug: 1 }`

---

### 9. Product Tags (`product_tags`) — Junction Table

```typescript
{
  _id: ObjectId,
  tenantId: string,
  productId: ObjectId,           // Reference to Product
  tagId: ObjectId,               // Reference to Tag
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ tenantId: 1, productId: 1, tagId: 1 }` — unique (chống trùng)
- `{ tenantId: 1, tagId: 1 }` — query "sản phẩm thuộc tag X"

---

### 10. Product Taxonomies (`product_taxonomies`) — v1 Junction

```typescript
{
  _id: ObjectId,
  tenantId: string,
  productId: ObjectId,
  taxonomyType: string,          // 'segment' | 'scent_group' | 'concentration'
  taxonomyId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 11. Product Taxonomy Terms (`product_taxonomy_terms`) — v2 Junction

```typescript
{
  _id: ObjectId,
  tenantId: string,
  productId: ObjectId,           // Reference to Product
  taxonomyTermId: ObjectId,      // Reference to TaxonomyTerm
  createdAt: Date,
  updatedAt: Date
}
```

---

### 12. Taxonomies (`taxonomies`) — v2 Parent

```typescript
{
  _id: ObjectId,
  tenantId: string,
  slug: 'scent_group' | 'concentration' | 'segment',  // Unique per tenant
  name: string,                  // "Nhóm mùi hương", "Nồng độ", "Phân khúc"
  description?: string,
  sortOrder?: number,
  status: 'active' | 'inactive',
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ tenantId: 1, slug: 1 }` — unique compound

---

### 13. Taxonomy Terms (`taxonomy_terms`) — v2 Child

```typescript
{
  _id: ObjectId,
  tenantId: string,
  taxonomyId: ObjectId,          // Reference to Taxonomy (parent)
  name: string,                  // Indexed
  slug: string,                  // Indexed
  description?: string,
  sortOrder?: number,
  status: 'active' | 'inactive',
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ tenantId: 1, taxonomyId: 1, slug: 1 }` — unique compound

---

### 14. Segments / Scent Groups / Concentrations (`segments`, `scent_groups`, `concentrations`) — LEGACY

Cả 3 collection đều có cấu trúc giống hệt:

```typescript
{
  _id: ObjectId,
  tenantId: string,
  name: string,                  // Indexed
  slug: string,                  // Indexed
  description?: string,
  sortOrder?: number,
  status: 'active' | 'inactive',
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ tenantId: 1, slug: 1 }` — unique

> **DEPRECATED**: Các collection này đã được thay thế bởi hệ thống `Taxonomy` + `TaxonomyTerm` (v2). Giữ lại để backward compatibility trong quá trình frontend migration.

---

### 15. Orders (`orders`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  userId?: ObjectId,             // Reference to User (optional for guest)
  customerName: string,
  customerEmail?: string,
  customerPhone?: string,
  customerAddress?: string,
  totalAmount: number,
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
  paymentMethod: 'cod' | 'bank_transfer' | 'credit_card' | 'momo' | 'zalopay',
  paymentStatus: 'unpaid' | 'paid' | 'refunded',
  items: ObjectId[],             // References to OrderItem
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ tenantId: 1, userId: 1 }` — user's orders
- `{ tenantId: 1, status: 1 }` — filter by status
- `{ tenantId: 1, paymentStatus: 1 }`
- `{ tenantId: 1, createdAt: -1 }` — sort by date

---

### 16. Order Items (`order_items`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  orderId: ObjectId,             // Reference to Order
  productId: ObjectId,           // Reference to Product
  name: string,                  // Snapshot at order time
  brand?: string,
  quantity: number,
  price: number,                 // Price at order time
  subTotal: number,              // quantity * price
  image?: string,                // Product image URL
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ orderId: 1 }`, `{ tenantId: 1 }`

---

### 17. Homepage Config (`homepage_configs`)

```typescript
{
  _id: ObjectId,
  tenantId: string,

  sections: [{
    id: string,                  // 'banner' | 'brandsMarquee' | 'saleProducts' | ...
    enabled: boolean,
    order: number
  }],

  bannerImages: string[],        // URLs (default: 4 banners)
  bannerTitleVi: string,
  bannerSubtitleVi: string,
  bannerLabelVi: string,
  bannerTitleEn: string,
  bannerSubtitleEn: string,
  bannerLabelEn: string,

  galleryVi: [{
    url: string,
    aspect: string,              // 'aspect-[3/4]'
    title: string,
    quote: string
  }],
  galleryEn: [{ ... }],         // Same structure, English

  productCardConfig: {
    imageAspect: 'square' | 'portrait' | 'landscape',
    imagePadding: number,        // Default: 40
    cardRadius: number,          // Default: 16
    tagBgColor: string,          // '#FFFFFF'
    tagTextColor: string,        // '#7A5C5C'
    discountBadgeBg: string,     // '#D4A5A5'
    discountBadgeText: string,   // '#FFFFFF'
    brandFontSize: number,
    nameFontSize: number,
    priceFontSize: number,
    textAlign: 'center' | 'left',
    elementOrder: string[],      // ['keywords', 'brand', 'name', 'sizes', 'rating', 'price']
    showKeywords: boolean,
    showSizes: boolean,
    showRating: boolean
  },

  updatedAt: Date
}
```

**Default sections (ordered):**
1. banner
2. brandsMarquee
3. saleProducts
4. newProducts
5. trendingProducts
6. brandUsp
7. luxuryGallery
8. blogPosts

---

### 18. Knowledge (`knowledge`) — AI RAG

```typescript
{
  _id: ObjectId,
  tenantId: string,              // Default: 'default-tenant'
  question: string,              // Indexed
  answer: string,
  createdAt: Date
}
```

**Indexes:** `{ question: 1, tenantId: 1 }` — unique compound

---

### 19. Audit Logs (`audit_logs`)

```typescript
{
  _id: ObjectId,
  userId: ObjectId,              // Reference to User
  action: string,                // 'LOGIN', 'PASSWORD_CHANGE', 'DELETE_USER'...
  resource: string,              // 'User', 'Content', 'Product'...
  tenantId: string,
  metadata: any,                 // IP, Browser, affected record ID
  status: 'SUCCESS' | 'FAILURE',
  createdAt: Date                // Indexed
}
```

**Indexes:** `{ tenantId: 1, action: 1, createdAt: -1 }`

---

### 20. Content (`contents`)

```typescript
{
  _id: ObjectId,
  tenantId: string,
  title: string,
  slug: string,
  content: string,
  type: string,                  // 'blog' | 'page' | 'faq'
  status: 'draft' | 'published',
  tags: string[],
  createdAt: Date,
  updatedAt: Date
}
```

---

## Relationships Diagram

```
User ──< UserAddress          (1 user → nhiều địa chỉ)
User ──< Order                (1 user → nhiều đơn hàng)

Brand ──< Product             (1 brand → nhiều sản phẩm)

Product ──< ProductVariant    (1 product → nhiều variants)
Product ──< ProductImage      (1 product → nhiều images)
Product ──< ProductSEO        (1 product → 1 SEO record)
Product ──< ProductTag >── Tag (nhiều-nhiều qua junction)
Product ──< ProductTaxonomyTerm >── TaxonomyTerm >── Taxonomy

Taxonomy ──< TaxonomyTerm     (1 taxonomy → nhiều terms)

Order ──< OrderItem           (1 order → nhiều items)
OrderItem >── Product         (nhiều items → 1 product)
```

---

## Multi-tenancy Implementation

```typescript
// Mongoose plugin: tự động thêm tenantId field + filter
export function multiTenancyPlugin(schema: Schema) {
  schema.add({ tenantId: { type: String, required: true, index: true } });

  // Auto-filter mọi query
  schema.pre(/^find|count|update|delete/, function() {
    const filter = this.getFilter();
    if (filter && !filter.tenantId && (this as any)._tenantId) {
      this.where({ tenantId: (this as any)._tenantId });
    }
  });

  // Helper: .forTenant(tenantId)
  (schema.query as any).forTenant = function(tenantId: string) {
    this._tenantId = tenantId;
    return this.where({ tenantId });
  };
}
```

---

## Index Strategy

### Compound Indexes
```javascript
{ tenantId: 1, slug: 1 }           // Unique: Taxonomy, Tag, Segment, ...
{ tenantId: 1, email: 1 }          // Unique: User
{ tenantId: 1, name: 1 }           // Search: Product, Brand
{ tenantId: 1, status: 1 }         // Filter: Product, Order
{ tenantId: 1, createdAt: -1 }     // Sort: Order, AuditLog
```

### Junction Table Indexes
```javascript
{ tenantId: 1, productId: 1, tagId: 1 }    // Unique: ProductTag
{ tenantId: 1, tagId: 1 }                   // Query by tag
{ productId: 1 }                             // Query by product
```

### Vector Index (AI Search)
- Collection: `product_seo`
- Field: `embedding` (number[], 3072 dimensions)
- Distance: Cosine similarity

---

## Backup Strategy

**Automated Backups:** MongoDB Atlas daily automated backups
- Retention: 7 days (free), 30 days (paid)

**Manual Backup:**
```bash
mongodump --uri="mongodb+srv://..." --out=./backup
mongorestore --uri="mongodb+srv://..." ./backup
```
