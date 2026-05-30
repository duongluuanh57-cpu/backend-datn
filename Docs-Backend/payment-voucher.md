# Payment & Voucher

## Payment System

**Methods:** `cod`, `bank_transfer`, `credit_card`, `momo`, `zalopay`

**Lifecycle:**
```
pending → paid → refunded
pending → failed
```

**Model fields:** `orderId`, `method`, `amount`, `status`, `transactionCode`, `paidAt`, `refundedAt`

**Endpoints:**
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/payments` | ADMIN |
| POST | `/api/payments` | ADMIN |
| PATCH | `/api/payments/:id/paid` | ADMIN |
| PATCH | `/api/payments/:id/failed` | ADMIN |
| PATCH | `/api/payments/:id/refunded` | ADMIN |
| DELETE | `/api/payments/:id` | ADMIN |

## Voucher System

**Types:** `percentage` | `fixed`

**Model fields:** `code` (uppercase), `type`, `value`, `minOrderAmount`, `maxDiscount` (percentage only), `maxUsage`, `usedCount`, `startDate`, `endDate`, `status`

**Discount calculation:**
- Percentage: `min(orderAmount × value / 100, maxDiscount || ∞)`
- Fixed: `= value`

**Validation logic:**
1. Code exists & status === `active`
2. `startDate ≤ now ≤ endDate`
3. `usedCount < maxUsage` (if maxUsage > 0)
4. `orderAmount ≥ minOrderAmount`

**Endpoints:**
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/vouchers/validate` | Public |
| GET | `/api/vouchers` | Any |
| POST | `/api/vouchers` | ADMIN |
| PATCH | `/api/vouchers/:id` | ADMIN |
| DELETE | `/api/vouchers/:id` | ADMIN |

**Order integration:** On order creation → validate voucher → apply discount → `incrementUsage()` → create payment (pending)
