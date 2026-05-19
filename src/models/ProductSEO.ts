import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IProductSEO extends Document {
  tenantId: string;
  productId: mongoose.Types.ObjectId;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  slug?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  embedding?: number[]; // Vector embedding cho AI search
  priceReport?: string; // AI price analysis report
  sizeReport?: string; // AI size recommendation report
  discountReport?: string; // AI discount strategy report
  createdAt: Date;
  updatedAt: Date;
}

const ProductSEOSchema = new Schema<IProductSEO>(
  {
    tenantId: { type: String, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true, index: true },
    metaTitle: { type: String },
    metaDescription: { type: String },
    keywords: [{ type: String }],
    slug: { type: String, index: true },
    ogTitle: { type: String },
    ogDescription: { type: String },
    ogImage: { type: String },
    canonicalUrl: { type: String },
    embedding: { type: [Number] },
    priceReport: { type: String },
    sizeReport: { type: String },
    discountReport: { type: String },
  },
  {
    timestamps: true,
    collection: 'product_seo',
  }
);

ProductSEOSchema.plugin(multiTenancyPlugin);

export const ProductSEO =
  mongoose.models.ProductSEO ||
  mongoose.model<IProductSEO>('ProductSEO', ProductSEOSchema);
