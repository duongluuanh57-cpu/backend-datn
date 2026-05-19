import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IScentGroup extends Document {
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScentGroupSchema = new Schema<IScentGroup>(
  {
    name: { type: String, required: true, index: true },
    slug: { type: String, required: true, index: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  {
    timestamps: true,
    collection: 'scent_groups'
  }
);

ScentGroupSchema.plugin(multiTenancyPlugin);

export const ScentGroup = mongoose.models.ScentGroup || mongoose.model<IScentGroup>('ScentGroup', ScentGroupSchema);
