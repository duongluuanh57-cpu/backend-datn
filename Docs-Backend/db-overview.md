# Database Overview

## Stack
- **MongoDB Atlas** — managed cloud database
- **Multi-tenancy** — `tenantId` field on every collection
- **ODM** — Mongoose v9

## Collections (24)

| # | Collection | Description |
|---|-----------|-------------|
| 1 | `users` | User accounts & auth |
| 2 | `user_addresses` | User shipping addresses |
| 3 | `brands` | Product brands |
| 4 | `tags` | Product tags |
| 5 | `categories` | Product categories |
| 6 | `products` | Core product catalog |
| 7 | `product_variants` | SKU-level variants |
| 8 | `product_images` | Product media files |
| 9 | `product_seo` | SEO metadata & embeddings |
| 10 | `product_tags` | M2M product–tag link |
| 11 | `product_taxonomies` | M2M product–taxonomy link |
| 12 | `product_taxonomy_terms` | M2M product–taxonomy term |
| 13 | `taxonomies` | Taxonomy groups (v2) |
| 14 | `taxonomy_terms` | Taxonomy term values (v2) |
| 15 | `media` | Uploaded media assets |
| 16 | `segments` (legacy) | Legacy segment taxonomy |
| 17 | `scent_groups` (legacy) | Legacy scent taxonomy |
| 18 | `concentrations` (legacy) | Legacy concentration taxonomy |
| 19 | `orders` | Customer orders |
| 20 | `order_items` | Line items per order |
| 21 | `homepage_configs` | Homepage layout data |
| 22 | `contents` | CMS pages & blog posts |
| 23 | `knowledge` | FAQ / RAG QA pairs |
| 24 | `audit_logs` | Admin action audit trail |
| 25 | `payments` | Payment transactions |
| 26 | `vouchers` | Discount vouchers |

> **Note**: numbering includes legacy collections that share the v2 taxonomies namespace.

## Entity Relationships

```
User ──< UserAddress
User ──< Order
Brand ──< Product
Product ──< ProductVariant, ProductImage, ProductSEO
Product ──< ProductTag >── Tag
Product ──< ProductTaxonomyTerm >── TaxonomyTerm >── Taxonomy
Order ──< OrderItem >── Product
Order ──< Payment
```
