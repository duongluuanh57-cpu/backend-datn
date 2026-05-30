import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface ICategory extends Document {
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  sortOrder?: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    sortOrder: { type: Number, default: 0 },
    tenantId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
    collection: 'categories'
  }
);

CategorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ tenantId: 1, sortOrder: 1 });
CategorySchema.index({ tenantId: 1, name: 1 });

CategorySchema.plugin(multiTenancyPlugin);

export const Category = mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);
