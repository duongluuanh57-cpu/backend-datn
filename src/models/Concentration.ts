import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IConcentration extends Document {
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ConcentrationSchema = new Schema<IConcentration>(
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
    collection: 'concentrations',
  }
);

ConcentrationSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

ConcentrationSchema.plugin(multiTenancyPlugin);

export const Concentration =
  mongoose.models.Concentration ||
  mongoose.model<IConcentration>('Concentration', ConcentrationSchema);
