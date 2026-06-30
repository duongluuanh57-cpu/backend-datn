import mongoose, { Schema, Document } from 'mongoose';

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  tenantId: string;
  totalAmount: number;
  voucherCode?: string;
  voucherDiscount?: number;
  updatedAt: Date;
  createdAt: Date;
}

const CartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    tenantId: { type: String, required: true, default: 'default' },
    totalAmount: { type: Number, default: 0 },
    voucherCode: { type: String, default: null },
    voucherDiscount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CartSchema.index({ tenantId: 1 });

export default mongoose.model<ICart>('Cart', CartSchema);