import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';
import { AIService } from '../services/AIService.ts';

export interface IProduct extends Document {
  name: string;
  brandId: mongoose.Types.ObjectId; // Reference to Brand
  price: number; // Giá base (có thể là giá thấp nhất của variants)
  variants?: mongoose.Types.ObjectId[]; // References to ProductVariant

  description: string;
  image?: string; // URL ảnh chính (denormalized từ ProductImage)
  // tags đã được chuyển sang bảng trung gian ProductTag
  // scentGroups, concentrations, segments đã được chuyển sang bảng trung gian ProductTaxonomyTerm
  categories?: mongoose.Types.ObjectId[];
  rating?: number;
  reviewsCount?: number;
  quantityInStock: number; // Tổng số lượng tồn kho (tính từ variants)
  discountPercentage?: number;
  discountStartDate?: Date | null;
  discountEndDate?: Date | null;
  soldCount?: number;
  longevity?: string;
  sillage?: string;
  durability?: string;
  scentTrail?: string;
  style?: string;
  suitableFor?: string;
  occasion?: string;
  season?: string;
  time?: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    price: { type: Number, required: true },
    variants: [{ type: Schema.Types.ObjectId, ref: 'ProductVariant' }],

    description: { type: String },
    image: { type: String },
    // tags đã được chuyển sang ProductTag (bảng trung gian)
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    rating: { type: Number, default: 5 },
    reviewsCount: { type: Number, default: 0 },
    quantityInStock: { type: Number, default: 0 },
    discountPercentage: { type: Number, default: 0 },
    discountStartDate: { type: Date, default: null },
    discountEndDate: { type: Date, default: null },
    soldCount: { type: Number, default: 0 },
    longevity: { type: String, default: '' },
    sillage: { type: String, default: '' },
    durability: { type: String, default: '' },
    scentTrail: { type: String, default: '' },
    style: { type: String, default: '' },
    suitableFor: { type: String, default: '' },
    occasion: { type: String, default: '' },
    season: { type: String, default: '' },
    time: { type: String, default: '' },
    tenantId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
    collection: 'products'
  }
);

/**
 * TỰ ĐỘNG NẠP KIẾN THỨC (Auto-Ingestion)
 * Mỗi khi lưu sản phẩm, tự động tạo Vector Embedding để AI thấu hiểu sản phẩm
 * Embedding được lưu trong ProductSEO collection
 */
ProductSchema.post('save', async function() {
  try {
    console.log(`🧠 [AI Auto-Train] Đang nạp kiến thức cho sản phẩm: ${this.name}`);
    
    // Populate brand + categories để lấy tên
    await this.populate(['brandId', 'categories']);
    const brandName = (this.brandId as any)?.name || '';
    const categoryNames = (this.categories as any[] || []).map((c: any) => c?.name).filter(Boolean).join(' ');
    
    const textToEmbed = `${this.name} ${brandName} ${this.description} ${categoryNames}`;
    
    // Gọi AI Service để lấy "vân tay ý nghĩa"
    const vector = await AIService.generateEmbedding(textToEmbed);
    
    // Lưu embedding vào ProductSEO
    const { ProductSEO } = await import('./ProductSEO.ts');
    await ProductSEO.findOneAndUpdate(
      { productId: this._id, tenantId: this.tenantId },
      {
        $set: { embedding: vector },
        $setOnInsert: {
          tenantId: this.tenantId,
          productId: this._id,
          slug: this.name ? this.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '',
          metaTitle: this.name || '',
          metaDescription: '',
          keywords: [],
          priceReport: '',
          sizeReport: '',
          discountReport: '',
        }
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('⚠️ [AI Auto-Train Error] Không thể tạo embedding:', err);
  }
});

// Compound indexes cho admin queries
ProductSchema.index({ tenantId: 1, createdAt: -1 });
ProductSchema.index({ tenantId: 1, name: 1 });
ProductSchema.index({ tenantId: 1, brandId: 1 });
ProductSchema.index({ tenantId: 1, quantityInStock: 1 });
ProductSchema.index({ tenantId: 1, price: 1 });
ProductSchema.index({ tenantId: 1, soldCount: -1, createdAt: -1 });

// Text index for full-text search across name and description (used by getAllProducts)
ProductSchema.index({ name: 'text', description: 'text' });

ProductSchema.plugin(multiTenancyPlugin);

export const Product = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
