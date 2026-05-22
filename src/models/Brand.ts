import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IBrand extends Document {
  name: string;
  logo?: string;
  description?: string;
  origin?: string;
  status: 'active' | 'inactive';
  featured: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    name: { type: String, required: true, index: true },
    logo: { type: String },
    description: { type: String },
    origin: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    featured: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    collection: 'brands'
  }
);

BrandSchema.index({ tenantId: 1, name: 1 });
BrandSchema.index({ tenantId: 1, origin: 1 });

BrandSchema.plugin(multiTenancyPlugin);

export const Brand = mongoose.models.Brand || mongoose.model<IBrand>('Brand', BrandSchema);
