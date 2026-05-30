# Orders & Order Items

## Orders (`orders`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | ObjectId | ref `users` |
| `orderCode` | String | unique, human-readable |
| `status` | String | `pending` / `processing` / `shipped` / `delivered` / `cancelled` |
| `paymentStatus` | String | `unpaid` / `paid` / `refunded` |
| `paymentMethod` | String | `cod` / `bank_transfer` / `credit_card` / `momo` / `zalopay` |
| `totalAmount` | Number | |
| `shippingAddress` | Mixed | embedded address |
| `notes` | String | |
| `tenantId` | String | |

**Indexes:**
- `{ orderCode: 1 }` (unique)
- `{ userId: 1 }`
- `{ status: 1 }`
- `{ paymentStatus: 1 }`
- `{ tenantId: 1 }`
- `{ createdAt: -1 }`

## Order Items (`order_items`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `orderId` | ObjectId | ref `orders` |
| `productId` | ObjectId | ref `products` |
| `variantId` | ObjectId | ref `product_variants` |
| `productName` | String | snapshot at order time |
| `quantity` | Number | |
| `unitPrice` | Number | |
| `totalPrice` | Number | |

**Indexes:**
- `{ orderId: 1 }`
- `{ productId: 1 }`
