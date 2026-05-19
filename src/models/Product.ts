import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';
import { AIService } from '../services/AIService.ts';

export interface IProduct extends Document {
  name: string;
  brand: string;
  price: number;
  image: string;
  description: string;
  tag?: string;
  scentGroup?: string;
  concentration?: string;
  segment?: string;
  gender?: string;
  rating?: number;
  reviewsCount?: number;
  size?: string;
  quantityInStock: number;
  discountPercentage?: number;
  discountStartDate?: Date | null;
  discountEndDate?: Date | null;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  soldCount?: number;
  embedding?: number[]; // Trường lưu trữ vector ý nghĩa cho AI
  tenantId: string;
  priceReport?: string;
  sizeReport?: string;
  discountReport?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, index: true },
    brand: { type: String, required: true, index: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    description: { type: String },
    tag: { type: String },
    scentGroup: { type: String },
    concentration: { type: String },
    segment: { type: String },
    gender: { type: String },
    rating: { type: Number, default: 5 },
    reviewsCount: { type: Number, default: 0 },
    size: { type: String },
    quantityInStock: { type: Number, default: 0 },
    discountPercentage: { type: Number, default: 0 },
    discountStartDate: { type: Date, default: null },
    discountEndDate: { type: Date, default: null },
    metaTitle: { type: String },
    metaDescription: { type: String },
    keywords: [{ type: String }],
    soldCount: { type: Number, default: 0 },
    embedding: { type: [Number] }, // Định dạng mảng số thực
    tenantId: { type: String, required: true, index: true },
    priceReport: { type: String },
    sizeReport: { type: String },
    discountReport: { type: String },
  },
  {
    timestamps: true,
    collection: 'products'
  }
);

/**
 * TỰ ĐỘNG NẠP KIẾN THỨC (Auto-Ingestion)
 * Mỗi khi lưu sản phẩm, tự động tạo Vector Embedding để AI thấu hiểu sản phẩm
 */
ProductSchema.pre('save', async function() {
  // Chỉ chạy nếu các trường quan trọng thay đổi
  if (this.isModified('name') || this.isModified('brand') || this.isModified('description') || this.isModified('gender') || this.isModified('scentGroup') || this.isModified('concentration') || this.isModified('segment')) {
    try {
      console.log(`🧠 [AI Auto-Train] Đang nạp kiến thức cho sản phẩm: ${this.name}`);
      const textToEmbed = `${this.name} ${this.brand} ${this.description} ${this.keywords?.join(' ')} ${this.gender || ''} ${this.scentGroup || ''} ${this.concentration || ''} ${this.segment || ''}`;
      
      // Gọi AI Service để lấy "vân tay ý nghĩa"
      const vector = await AIService.generateEmbedding(textToEmbed);
      this.embedding = vector;
    } catch (err) {
      console.error('⚠️ [AI Auto-Train Error] Không thể tạo embedding:', err);
    }
  }
});

ProductSchema.plugin(multiTenancyPlugin);

export const Product = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
