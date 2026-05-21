import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

/**
 * ProductTaxonomyTerm — bảng TRUNG GIAN liên kết Product ↔ TaxonomyTerm
 *
 * Thay thế cho các mảng scentGroups / concentrations / segments trong Product.
 * Một sản phẩm có thể gán nhiều term từ nhiều taxonomy khác nhau.
 */
export interface IProductTaxonomyTerm extends Document {
  tenantId: string;
  productId: mongoose.Types.ObjectId;   // Reference to Product
  termId: mongoose.Types.ObjectId;      // Reference to TaxonomyTerm
  taxonomyId: mongoose.Types.ObjectId;  // Denormalized từ TaxonomyTerm.taxonomyId — giúp filter nhanh
  createdAt: Date;
  updatedAt: Date;
}

const ProductTaxonomyTermSchema = new Schema<IProductTaxonomyTerm>(
  {
    tenantId: { type: String, required: true, index: true },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    termId: {
      type: Schema.Types.ObjectId,
      ref: 'TaxonomyTerm',
      required: true,
      index: true,
    },
    taxonomyId: {
      type: Schema.Types.ObjectId,
      ref: 'Taxonomy',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'product_taxonomy_terms',
  }
);

// Một sản phẩm không thể gán cùng một term hai lần
ProductTaxonomyTermSchema.index({ tenantId: 1, productId: 1, termId: 1 }, { unique: true });

// Index để query nhanh: "Lấy tất cả sản phẩm thuộc taxonomy X"
ProductTaxonomyTermSchema.index({ tenantId: 1, taxonomyId: 1, productId: 1 });

ProductTaxonomyTermSchema.plugin(multiTenancyPlugin);

export const ProductTaxonomyTerm =
  mongoose.models.ProductTaxonomyTerm ||
  mongoose.model<IProductTaxonomyTerm>('ProductTaxonomyTerm', ProductTaxonomyTermSchema);
