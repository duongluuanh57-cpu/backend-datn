import dotenv from 'dotenv';
dotenv.config(); // Nạp env ngay lập tức ở dòng đầu tiên

import mongoose from 'mongoose';
import { AIService } from '../src/services/AIService.ts';

/**
 * SCRIPT ĐỒNG BỘ KIẾN THỨC TOÀN DIỆN
 */

const ProductSchema = new mongoose.Schema({
  name: String,
  brand: String,
  description: String,
  keywords: [String],
  embedding: [Number],
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema, 'products');

async function syncAll() {
  try {
    console.log('🔗 Đang kết nối Database...');
    await mongoose.connect(process.env.MONGO_URI || '');
    
    const products = await Product.find({}).lean();
    console.log(`🔍 Tìm thấy ${products.length} sản phẩm cần đồng bộ kiến thức...`);

    for (const p of products) {
      console.log(`🧠 Đang dạy AI về sản phẩm: ${p.name}...`);
      const text = `${p.name} ${p.brand} ${p.description} ${p.keywords?.join(' ')}`;
      const vector = await AIService.generateEmbedding(text);
      
      await Product.updateOne({ _id: p._id }, { $set: { embedding: vector } });
    }

    console.log('✅ ĐÃ ĐỒNG BỘ XONG!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi đồng bộ:', err);
    process.exit(1);
  }
}

syncAll();
