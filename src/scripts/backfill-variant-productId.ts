/**
 * Migration: Backfill productId vào product_variants
 *
 * Sau khi đã có Product.variants[], đọc từng product,
 * rồi update productId cho từng variant tương ứng.
 *
 * Chạy: node --strip-types src/scripts/backfill-variant-productId.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function backfillVariantProductId() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';

  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const db = mongoose.connection.db!;
    const productsCol = db.collection('products');
    const variantsCol = db.collection('product_variants');

    // Lấy tất cả products có variants[]
    const products = await productsCol
      .find({ variants: { $exists: true, $ne: [] } })
      .toArray();

    console.log(`📦 Tìm thấy ${products.length} products có variants\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const product of products) {
      const variantIds = product.variants || [];
      if (variantIds.length === 0) continue;

      for (const variantId of variantIds) {
        try {
          const result = await variantsCol.updateOne(
            { _id: variantId },
            { $set: { productId: product._id } }
          );

          if (result.matchedCount === 0) {
            console.warn(`⚠️  Variant ${variantId} không tồn tại — skip`);
            skipCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`❌ Lỗi khi update variant ${variantId}:`, err);
          errorCount++;
        }
      }

      console.log(`✅ Product ${product._id} → backfill ${variantIds.length} variant(s)`);
    }

    console.log('\n========================================');
    console.log('🎉 Migration hoàn tất!');
    console.log(`   ✅ Thành công : ${successCount} variants`);
    console.log(`   ⚠️  Bỏ qua    : ${skipCount} variants`);
    console.log(`   ❌ Lỗi       : ${errorCount} variants`);
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

backfillVariantProductId();
