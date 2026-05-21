import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

/**
 * Taxonomy — bảng CHA định nghĩa các loại phân loại sản phẩm
 * Ví dụ: "Nhóm mùi hương", "Nồng độ", "Phân khúc"
 */
export type TaxonomySlug = 'scent_group' | 'concentration' | 'segment';

export interface ITaxonomy extends Document {
  tenantId: string;
  slug: TaxonomySlug;   // Định danh kỹ thuật, unique per tenant
  name: string;         // Tên hiển thị: "Nhóm mùi hương", "Nồng độ", ...
  description?: string;
  sortOrder?: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const TaxonomySchema = new Schema<ITaxonomy>(
  {
    tenantId: { type: String, required: true, index: true },
    slug: {
      type: String,
      required: true,
      enum: ['scent_group', 'concentration', 'segment'],
      index: true,
    },
    name: { type: String, required: true },
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
    collection: 'taxonomies',
  }
);

// Mỗi tenant chỉ có 1 taxonomy với cùng slug
TaxonomySchema.index({ tenantId: 1, slug: 1 }, { unique: true });

TaxonomySchema.plugin(multiTenancyPlugin);

export const Taxonomy =
  mongoose.models.Taxonomy ||
  mongoose.model<ITaxonomy>('Taxonomy', TaxonomySchema);
