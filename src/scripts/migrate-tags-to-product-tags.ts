/**
 * Migration: Chuyển tags[] trong products → collection product_tags
 *
 * Vấn đề cũ: Product document có mảng tags: ObjectId[]
 * Cấu trúc mới: Bảng trung gian product_tags { productId, tagId, tenantId }
 *
 * Script này:
 *   1. Đọc tất cả products còn field tags[] (array không rỗng)
 *   2. Insert từng cặp (productId, tagId) vào collection product_tags
 *   3. Unset field tags[] khỏi products sau khi migrate xong
 *
 * Chạy: npx tsx src/scripts/migrate-tags-to-product-tags.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function migrateTagsToProductTags() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';

  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const db = mongoose.connection.db!;
    const productsCol = db.collection('products');
    const productTagsCol = db.collection('product_tags');

    // ── Step 1: Kiểm tra tình trạng hiện tại ──────────────────────────────
    console.log('--- Step 1: Kiểm tra dữ liệu ---');
    const totalProducts = await productsCol.countDocuments();
    const productsWithTags = await productsCol.countDocuments({
      tags: { $exists: true, $not: { $size: 0 } }
    });
    const existingProductTags = await productTagsCol.countDocuments();

    console.log(`📦 Tổng products       : ${totalProducts}`);
    console.log(`🏷️  Products có tags[]  : ${productsWithTags}`);
    console.log(`📋 product_tags hiện có: ${existingProductTags}\n`);

    if (productsWithTags === 0) {
      console.log('ℹ️  Không có product nào còn tags[]. Migration không cần thiết.');
      await mongoose.disconnect();
      return;
    }

    // ── Step 2: Tạo unique index trên product_tags nếu chưa có ───────────
    console.log('--- Step 2: Đảm bảo index trên product_tags ---');
    try {
      await productTagsCol.createIndex(
        { tenantId: 1, productId: 1, tagId: 1 },
        { unique: true, name: 'tenantId_productId_tagId_unique' }
      );
      console.log('✅ Index (tenantId, productId, tagId) unique đã sẵn sàng\n');
    } catch (err: any) {
      if (err?.codeName === 'IndexAlreadyExists' || err?.code === 85 || err?.code === 86) {
        console.log('ℹ️  Index đã tồn tại, bỏ qua\n');
      } else {
        throw err;
      }
    }

    // ── Step 3: Migrate từng product ─────────────────────────────────────
    console.log('--- Step 3: Migrate tags[] → product_tags ---');

    const products = await productsCol
      .find({ tags: { $exists: true, $not: { $size: 0 } } })
      .project({ _id: 1, name: 1, tags: 1, tenantId: 1 })
      .toArray();

    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      const tags: any[] = product.tags || [];
      if (tags.length === 0) continue;

      for (const tagId of tags) {
        try {
          await productTagsCol.updateOne(
            {
              tenantId: product.tenantId,
              productId: product._id,
              tagId: tagId,
            },
            {
              $setOnInsert: {
                tenantId: product.tenantId,
                productId: product._id,
                tagId: tagId,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
            { upsert: true }
          );
          insertedCount++;
        } catch (err: any) {
          if (err?.code === 11000) {
            // Duplicate key — đã tồn tại, bỏ qua
            skippedCount++;
          } else {
            console.error(`❌ Lỗi product ${product._id} tag ${tagId}:`, err?.message);
            errorCount++;
          }
        }
      }

      console.log(`  ✅ ${product.name} (${product._id}) — ${tags.length} tag(s)`);
    }

    console.log(`\n📊 Kết quả insert:`);
    console.log(`   ✅ Inserted : ${insertedCount}`);
    console.log(`   ⏭️  Skipped  : ${skippedCount} (đã tồn tại)`);
    console.log(`   ❌ Errors   : ${errorCount}\n`);

    if (errorCount > 0) {
      console.error('⚠️  Có lỗi xảy ra. Dừng lại, KHÔNG xóa tags[] khỏi products.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // ── Step 4: Xóa field tags[] khỏi products ───────────────────────────
    console.log('--- Step 4: Xóa field tags[] khỏi products ---');
    const unsetResult = await productsCol.updateMany(
      { tags: { $exists: true } },
      { $unset: { tags: '' } }
    );
    console.log(`✅ Đã xóa tags[] khỏi ${unsetResult.modifiedCount} products\n`);

    // ── Step 5: Verify ────────────────────────────────────────────────────
    console.log('--- Step 5: Verify ---');
    const remainingWithTags = await productsCol.countDocuments({ tags: { $exists: true } });
    const finalProductTags = await productTagsCol.countDocuments();
    console.log(`🔍 Products còn tags[]    : ${remainingWithTags} (phải là 0)`);
    console.log(`🔍 Tổng rows product_tags : ${finalProductTags}\n`);

    console.log('========================================');
    console.log('🎉 Migration hoàn tất!');
    console.log(`   🏷️  Tags migrated : ${insertedCount}`);
    console.log(`   📦 Products xử lý: ${products.length}`);
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateTagsToProductTags();
