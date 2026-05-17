import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * SCRIPT NẠP KIẾN THỨC CHO AI (NotebookLM Mode)
 * Cách dùng: node scratch/ingest_data.js
 */

const ProductSchema = new mongoose.Schema({
  name: String,
  brand: String,
  price: Number,
  description: String,
  keywords: [String],
  tenantId: String,
  rating: Number,
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema, 'products');

const NEW_PRODUCTS = [
  {
    name: "Golden Oud Essence",
    brand: "L'essence Royale",
    price: 3200000,
    description: "Một loại nước hoa vương giả với hương gỗ trầm hương quý hiếm và hổ phách.",
    keywords: ["trầm hương", "oud", "luxury", "nam tính"],
    tenantId: "default-tenant",
    rating: 5.0
  },
  {
    name: "Summer Breeze Mist",
    brand: "L'essence Casual",
    price: 850000,
    description: "Hương thơm tươi mát của biển cả và cam quýt, phù hợp cho những ngày hè năng động.",
    keywords: ["tươi mát", "mùa hè", "unisex", "cam quýt"],
    tenantId: "default-tenant",
    rating: 4.7
  }
  // Bạn có thể thêm hàng trăm sản phẩm vào đây...
];

async function ingest() {
  try {
    console.log('🚀 Đang kết nối Database để nạp kiến thức...');
    await mongoose.connect(process.env.MONGO_URI || '');
    
    console.log(`📝 Đang nạp ${NEW_PRODUCTS.length} sản phẩm mới...`);
    
    // Thêm dữ liệu vào bảng products
    const result = await Product.insertMany(NEW_PRODUCTS);
    
    console.log('✅ Nạp dữ liệu THÀNH CÔNG!');
    console.log('💡 AI của bạn bây giờ đã biết về các sản phẩm này rồi đó.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi nạp dữ liệu:', err);
    process.exit(1);
  }
}

ingest();
