import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

/**
 * ProductTaxonomy — gộp segments, scent_groups, concentrations thành 1 collection
 * Phân biệt bằng field `type`
 */
export type TaxonomyType = 'segment' | 'scent_group' | 'concentration';

export interface IProductTaxonomy extends Document {
  tenantId: string;
  type: TaxonomyType;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ProductTaxonomySchema = new Schema<IProductTaxonomy>(
  {
    tenantId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['segment', 'scent_group', 'concentration'],
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
    collection: 'product_taxonomies',
  }
);

// Compound index: unique slug per type per tenant
ProductTaxonomySchema.index({ tenantId: 1, type: 1, slug: 1 }, { unique: true });
// Compound index for paginated search + sort by name
ProductTaxonomySchema.index({ tenantId: 1, type: 1, name: 1 });

ProductTaxonomySchema.plugin(multiTenancyPlugin);

export const ProductTaxonomy =
  mongoose.models.ProductTaxonomy ||
  mongoose.model<IProductTaxonomy>('ProductTaxonomy', ProductTaxonomySchema);
