import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export type PaymentMethod = 'cod' | 'bank_transfer' | 'credit_card' | 'momo' | 'zalopay';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface IPayment extends Document {
  tenantId: string;
  orderId: mongoose.Types.ObjectId; // Reference to Order
  method: PaymentMethod;
  amount: number;              // Tổng tiền đơn hàng
  status: PaymentStatus;
  transactionCode?: string;    // Mã giao dịch từ payment gateway
  paidAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    method: {
      type: String,
      required: true,
      enum: ['cod', 'bank_transfer', 'credit_card', 'momo', 'zalopay'],
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    transactionCode: { type: String },
    paidAt: { type: Date },
    refundedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'payments',
  }
);

PaymentSchema.index({ tenantId: 1, orderId: 1 });

PaymentSchema.plugin(multiTenancyPlugin);

export const Payment =
  mongoose.models.Payment ||
  mongoose.model<IPayment>('Payment', PaymentSchema);
