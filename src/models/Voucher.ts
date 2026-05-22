import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export type VoucherType = 'percentage' | 'fixed';

export interface IVoucher extends Document {
  tenantId: string;
  code: string;              // Mã giảm giá, VD: "SALE50", "WELCOME10"
  type: VoucherType;         // percentage: giảm theo %, fixed: giảm số tiền cố định
  value: number;             // percentage: 10 = 10%, fixed: 50000 = 50.000đ
  minOrderAmount: number;    // Đơn hàng tối thiểu để áp dụng
  maxDiscount?: number;      // Giảm tối đa (chỉ dùng cho percentage)
  maxUsage: number;          // Số lần sử dụng tối đa (0 = không giới hạn)
  usedCount: number;         // Số lần đã sử dụng
  startDate: Date;
  endDate: Date;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const VoucherSchema = new Schema<IVoucher>(
  {
    tenantId: { type: String, required: true, index: true },
    code: { type: String, required: true, uppercase: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['percentage', 'fixed'],
    },
    value: { type: Number, required: true },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    maxUsage: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'vouchers',
  }
);

// Mỗi tenant chỉ có 1 voucher với cùng code
VoucherSchema.index({ tenantId: 1, code: 1 }, { unique: true });

VoucherSchema.plugin(multiTenancyPlugin);

export const Voucher =
  mongoose.models.Voucher ||
  mongoose.model<IVoucher>('Voucher', VoucherSchema);