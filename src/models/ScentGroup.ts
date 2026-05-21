import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IScentGroup extends Document {
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ScentGroupSchema = new Schema<IScentGroup>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    slug: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  {
    timestamps: true,
    collection: 'scent_groups',
  }
);

ScentGroupSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

ScentGroupSchema.plugin(multiTenancyPlugin);

export const ScentGroup =
  mongoose.models.ScentGroup ||
  mongoose.model<IScentGroup>('ScentGroup', ScentGroupSchema);
