/**
 * Migration: Backfill Product.seoId + xóa productId khỏi product_seo
 *
 * Data cũ trong product_seo vẫn còn field productId.
 * Script này:
 *   1. Đọc tất cả product_seo docs còn productId
 *   2. Update Product.seoId = seo._id
 *   3. Unset productId khỏi product_seo (sau khi drop unique index)
 *
 * Chạy: node --strip-types src/scripts/migrate-seo-to-product.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function migrateSeoToProduct() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';

  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const db = mongoose.connection.db!;
    const seoCol = db.collection('product_seo');
    const productsCol = db.collection('products');

    // Lấy tất cả SEO docs còn productId
    const allSeo = await seoCol.find({ productId: { $exists: true } }).toArray();

    if (allSeo.length === 0) {
      console.log('⚠️  Không tìm thấy SEO doc nào có productId. Migration không cần thiết.');
      await mongoose.disconnect();
      return;
    }

    console.log(`📦 Tìm thấy ${allSeo.length} SEO docs cần migrate\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Step 1: Backfill Product.seoId
    console.log('--- Step 1: Backfill Product.seoId ---');
    for (const seoDoc of allSeo) {
      try {
        const result = await productsCol.updateOne(
          { _id: seoDoc.productId },
          { $set: { seoId: seoDoc._id } }
        );

        if (result.matchedCount === 0) {
          console.warn(`⚠️  Product ${seoDoc.productId} không tồn tại — skip`);
          skipCount++;
        } else {
          console.log(`✅ Product ${seoDoc.productId} → seoId: ${seoDoc._id}`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Lỗi khi update product ${seoDoc.productId}:`, err);
        errorCount++;
      }
    }

    console.log(`\n✅ Backfill xong: ${successCount} thành công, ${skipCount} bỏ qua, ${errorCount} lỗi\n`);

    // Step 2: Drop unique index productId_1 nếu còn
    console.log('--- Step 2: Xóa unique index productId_1 ---');
    try {
      await seoCol.dropIndex('productId_1');
      console.log('🗑️  Đã xóa unique index productId_1\n');
    } catch (err: any) {
      if (err?.codeName === 'IndexNotFound' || err?.code === 27) {
        console.log('ℹ️  Index productId_1 không tồn tại, bỏ qua\n');
      } else {
        throw err;
      }
    }

    // Step 3: Unset productId khỏi tất cả SEO docs
    console.log('--- Step 3: Xóa field productId khỏi product_seo ---');
    const unsetResult = await seoCol.updateMany(
      { productId: { $exists: true } },
      { $unset: { productId: '' } }
    );
    console.log(`✅ Đã xóa productId khỏi ${unsetResult.modifiedCount} SEO docs`);

    const remaining = await seoCol.countDocuments({ productId: { $exists: true } });
    console.log(`🔍 Còn lại ${remaining} docs có productId (phải là 0)\n`);

    console.log('========================================');
    console.log('🎉 Migration hoàn tất!');
    console.log(`   ✅ Thành công : ${successCount} products`);
    console.log(`   ⚠️  Bỏ qua    : ${skipCount} products`);
    console.log(`   ❌ Lỗi       : ${errorCount} products`);
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateSeoToProduct();
