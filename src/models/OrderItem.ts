import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IOrderItem extends Document {
  tenantId: string;
  orderId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  name: string;
  brand?: string;
  quantity: number;
  price: number;
  subTotal: number; // quantity * price
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    brand: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    subTotal: { type: Number, required: true },
    image: { type: String },
  },
  {
    timestamps: true,
    collection: 'order_items',
  }
);

OrderItemSchema.plugin(multiTenancyPlugin);

export const OrderItem =
  mongoose.models.OrderItem ||
  mongoose.model<IOrderItem>('OrderItem', OrderItemSchema);
