import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

/**
 * TaxonomyTerm — bảng CON chứa các giá trị cụ thể của một Taxonomy
 * Ví dụ: Taxonomy "Nhóm mùi hương" → Terms: "Hương gỗ", "Hương hoa", "Hương biển"
 */
export interface ITaxonomyTerm extends Document {
  tenantId: string;
  taxonomyId: mongoose.Types.ObjectId; // Reference to Taxonomy (cha)
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const TaxonomyTermSchema = new Schema<ITaxonomyTerm>(
  {
    tenantId: { type: String, required: true, index: true },
    taxonomyId: {
      type: Schema.Types.ObjectId,
      ref: 'Taxonomy',
      required: true,
      index: true,
    },
    name: { type: String, required: true, index: true },
    slug: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'taxonomy_terms',
  }
);

// Unique slug per taxonomy per tenant
TaxonomyTermSchema.index({ tenantId: 1, taxonomyId: 1, slug: 1 }, { unique: true });

TaxonomyTermSchema.plugin(multiTenancyPlugin);

export const TaxonomyTerm =
  mongoose.models.TaxonomyTerm ||
  mongoose.model<ITaxonomyTerm>('TaxonomyTerm', TaxonomyTermSchema);
