# Payment & Voucher — Elite SaaS Backend

## 1. Payment System

### Models

**Collection:** `payments`
**File:** `src/models/Payment.ts`

```typescript
{
  _id: ObjectId,
  tenantId: string,
  orderId: ObjectId,           // Reference to Order
  method: 'cod' | 'bank_transfer' | 'credit_card' | 'momo' | 'zalopay',
  amount: number,
  status: 'pending' | 'paid' | 'failed' | 'refunded',
  transactionCode?: string,    // Mã giao dịch từ gateway
  paidAt?: Date,
  refundedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Payment Lifecycle

```
  ┌──────────┐
  │  PENDING  │  ← Khởi tạo khi đơn hàng được tạo
  └────┬─────┘
       │
       ├─── paid ────→ ┌──────┐
       │               │ PAID │  ← Xác nhận bởi admin
       │               └──────┘
       │                   │
       │                   ├─── refunded ────→ ┌──────────┐
       │                   │                   │ REFUNDED │
       │                   │                   └──────────┘
       │                   │
       │                   └─── (kết thúc)
       │
       └─── failed ───→ ┌────────┐
                         │ FAILED │  ← Khi thanh toán thất bại
                         └────────┘
```

### Service Methods (`src/services/PaymentService.ts`)

| Method | Description |
|--------|-------------|
| `getAll(tenantId)` | Lấy tất cả payments (admin) |
| `getById(id, tenantId)` | Lấy 1 payment |
| `getByOrder(orderId, tenantId)` | Lấy payments theo đơn hàng |
| `create({ orderId, method, amount }, tenantId)` | Tạo payment mới (status: pending) |
| `markPaid(id, transactionCode, tenantId)` | Đánh dấu đã thanh toán |
| `markFailed(id, tenantId)` | Đánh dấu thất bại |
| `markRefunded(id, tenantId)` | Đánh dấu hoàn tiền |
| `delete(id, tenantId)` | Xoá payment |

### Controller Endpoints (`src/controllers/PaymentController.ts`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/payments` | ADMIN/SUBADMIN | List all |
| GET | `/api/payments/:id` | ADMIN/SUBADMIN | Get by ID |
| GET | `/api/payments/order/:orderId` | ADMIN/SUBADMIN | Get by order |
| POST | `/api/payments` | ADMIN/SUBADMIN | Create |
| PATCH | `/api/payments/:id/paid` | ADMIN/SUBADMIN | Mark paid |
| PATCH | `/api/payments/:id/failed` | ADMIN/SUBADMIN | Mark failed |
| PATCH | `/api/payments/:id/refunded` | ADMIN/SUBADMIN | Mark refunded |
| DELETE | `/api/payments/:id` | ADMIN/SUBADMIN | Delete |

---

## 2. Voucher System

### Models

**Collection:** `vouchers`
**File:** `src/models/Voucher.ts`

```typescript
{
  _id: ObjectId,
  tenantId: string,
  code: string,                // Uppercase, unique per tenant
  type: 'percentage' | 'fixed',
  value: number,               // 10 = 10%, hoặc 50000 = 50.000đ
  minOrderAmount: number,      // Default: 0
  maxDiscount?: number,        // Giảm tối đa (chỉ percentage)
  maxUsage: number,            // 0 = unlimited
  usedCount: number,           // Đã dùng bao nhiêu lần
  startDate: Date,
  endDate: Date,
  status: 'active' | 'inactive',
  createdAt: Date,
  updatedAt: Date
}
```

### Discount Calculation

```
Nếu type = 'percentage':
  discountAmount = min(orderAmount × value / 100, maxDiscount || ∞)

Nếu type = 'fixed':
  discountAmount = value
```

### Validation Logic (`VoucherService.validate()`)

```typescript
static async validate(code: string, orderAmount: number, tenantId: string) {
  // 1. Tìm voucher theo code (uppercase)
  // 2. Check status === 'active'
  // 3. Check startDate <= now <= endDate
  // 4. Check usedCount < maxUsage (nếu maxUsage > 0)
  // 5. Check orderAmount >= minOrderAmount
  // 6. Tính discountAmount
  // 7. Return { valid, message, voucher?, discountAmount? }
}
```

### Service Methods (`src/services/VoucherService.ts`)

| Method | Description |
|--------|-------------|
| `getAll(tenantId)` | Lấy tất cả vouchers |
| `getActive(tenantId)` | Lấy voucher đang hoạt động, còn hạn |
| `getById(id, tenantId)` | Lấy 1 voucher |
| `create(data, tenantId)` | Tạo voucher mới (code tự uppercase) |
| `update(id, data, tenantId)` | Cập nhật voucher |
| `delete(id, tenantId)` | Xoá voucher |
| `validate(code, orderAmount, tenantId)` | Kiểm tra mã giảm giá |
| `incrementUsage(id, tenantId)` | Tăng usedCount (gọi khi order thành công) |

### Controller Endpoints (`src/controllers/VoucherController.ts`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/vouchers` | Any | Admin: all, User: only active |
| GET | `/api/vouchers/:id` | Any | Get by ID |
| POST | `/api/vouchers/validate` | Any | Validate code (public) |
| POST | `/api/vouchers` | ADMIN/SUBADMIN | Create |
| PATCH | `/api/vouchers/:id` | ADMIN/SUBADMIN | Update |
| DELETE | `/api/vouchers/:id` | ADMIN/SUBADMIN | Delete |

---

## 3. Integration với Order

Khi order được tạo thành công:
1. Payment được tạo với status `pending`
2. Nếu có voucher → gọi `VoucherService.validate()`
3. Nếu valid → áp dụng discount, gọi `VoucherService.incrementUsage()`
4. Admin xác nhận → `PaymentService.markPaid()`
