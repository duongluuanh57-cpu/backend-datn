import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IOrder extends Document {
  tenantId: string;
  userId?: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  totalAmount: number;
  voucherId?: mongoose.Types.ObjectId; // Reference to Voucher
  discountAmount?: number; // Số tiền được giảm từ voucher
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: 'cod' | 'bank_transfer' | 'credit_card' | 'momo' | 'zalopay';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  items: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String },
    customerPhone: { type: String },
    customerAddress: { type: String },
    totalAmount: { type: Number, required: true },
    voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher' },
    discountAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'bank_transfer', 'credit_card', 'momo', 'zalopay'],
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
      index: true,
    },
    items: [{ type: Schema.Types.ObjectId, ref: 'OrderItem' }],
  },
  {
    timestamps: true,
    collection: 'orders',
  }
);

OrderSchema.index({ tenantId: 1, customerName: 1 });
OrderSchema.index({ tenantId: 1, customerEmail: 1 });
OrderSchema.index({ tenantId: 1, customerPhone: 1 });

OrderSchema.plugin(multiTenancyPlugin);

export const Order =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
