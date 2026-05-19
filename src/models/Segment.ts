import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface ISegment extends Document {
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const SegmentSchema = new Schema<ISegment>(
  {
    name: { type: String, required: true, index: true },
    slug: { type: String, required: true, index: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  {
    timestamps: true,
    collection: 'segments'
  }
);

SegmentSchema.plugin(multiTenancyPlugin);

export const Segment = mongoose.models.Segment || mongoose.model<ISegment>('Segment', SegmentSchema);
