# Vouchers & Payments

## Vouchers (`vouchers`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `code` | String | unique, indexed |
| `type` | String | `percentage` / `fixed` |
| `value` | Number | discount amount or % |
| `minOrderAmount` | Number | minimum spend |
| `maxDiscount` | Number | cap for percentage type |
| `maxUsage` | Number | total redeem limit |
| `usedCount` | Number | current usage count |
| `startDate` | Date | |
| `endDate` | Date | |
| `status` | String | `active` / `expired` / `disabled` |
| `tenantId` | String | |

**Indexes:**
- `{ code: 1 }` (unique)
- `{ status: 1, startDate: 1, endDate: 1 }`
- `{ tenantId: 1 }`

## Payments (`payments`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `orderId` | ObjectId | ref `orders` |
| `method` | String | `cod` / `bank_transfer` / `credit_card` / `momo` / `zalopay` |
| `amount` | Number | |
| `status` | String | `pending` / `paid` / `failed` / `refunded` |
| `transactionCode` | String | gateway transaction ID |
| `tenantId` | String | |

**Indexes:**
- `{ orderId: 1 }`
- `{ transactionCode: 1 }`
- `{ status: 1 }`
- `{ tenantId: 1 }`
