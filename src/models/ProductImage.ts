import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IProductImage extends Document {
  tenantId: string;
  productId: mongoose.Types.ObjectId; // Reference to Product
  url: string; // Image URL stored in R2 or other storage
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema<IProductImage>(
  {
    tenantId: { type: String, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    url: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'product_images',
  }
);

ProductImageSchema.plugin(multiTenancyPlugin);

export const ProductImage =
  mongoose.models.ProductImage ||
  mongoose.model<IProductImage>('ProductImage', ProductImageSchema);
