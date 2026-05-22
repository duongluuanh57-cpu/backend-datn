/**
 * backfill-product-image.ts
 *
 * Cập nhật field `image` trong Product từ ProductImage đầu tiên
 * Chạy: npx tsx src/scripts/backfill-product-image.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { Product } from '../models/Product.ts';
import { ProductImage } from '../models/ProductImage.ts';

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI chưa được set. Kiểm tra file .env');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log(`✅ Đã kết nối MongoDB: ${MONGO_URI}`);

  // Lấy tất cả product chưa có image
  const products = await Product.find({ $or: [{ image: { $exists: false } }, { image: null }, { image: '' }] }).lean();
  console.log(`📦 Tìm thấy ${products.length} sản phẩm chưa có image`);

  let updated = 0;
  for (const product of products) {
    // Lấy ảnh đầu tiên từ ProductImage
    const firstImage = await ProductImage.findOne({ productId: product._id, tenantId: product.tenantId })
      .sort({ createdAt: 1 })
      .lean();

    if (firstImage?.url) {
      await Product.updateOne(
        { _id: product._id },
        { $set: { image: firstImage.url } }
      );
      updated++;
      console.log(`   ✅ ${product.name} → ${firstImage.url.slice(0, 60)}...`);
    }
  }

  console.log(`\n🎉 Hoàn tất! Đã cập nhật image cho ${updated}/${products.length} sản phẩm.`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});