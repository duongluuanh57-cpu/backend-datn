import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IConcentration extends Document {
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConcentrationSchema = new Schema<IConcentration>(
  {
    name: { type: String, required: true, index: true },
    slug: { type: String, required: true, index: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  {
    timestamps: true,
    collection: 'concentrations'
  }
);

ConcentrationSchema.plugin(multiTenancyPlugin);

export const Concentration = mongoose.models.Concentration || mongoose.model<IConcentration>('Concentration', ConcentrationSchema);
