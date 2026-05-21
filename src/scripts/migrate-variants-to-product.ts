/**
 * Migration: Backfill Product.variants[]
 *
 * Data cũ trong product_variants vẫn còn field productId (ObjectId).
 * Script này đọc toàn bộ product_variants, group theo productId,
 * rồi update Product.variants = [array of variant _ids].
 *
 * Chạy: node --strip-types src/scripts/migrate-variants-to-product.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function migrateVariantsToProduct() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';

  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const db = mongoose.connection.db!;
    const variantsCol = db.collection('product_variants');
    const productsCol = db.collection('products');

    // Lấy tất cả variants còn productId
    const allVariants = await variantsCol
      .find({ productId: { $exists: true } })
      .toArray();

    if (allVariants.length === 0) {
      console.log('⚠️  Không tìm thấy variant nào có productId. Migration không cần thiết.');
      await mongoose.disconnect();
      return;
    }

    console.log(`📦 Tìm thấy ${allVariants.length} variants cần migrate\n`);

    // Group variants theo productId
    const variantsByProduct = new Map<string, mongoose.Types.ObjectId[]>();
    for (const variant of allVariants) {
      const pId = variant.productId.toString();
      if (!variantsByProduct.has(pId)) {
        variantsByProduct.set(pId, []);
      }
      variantsByProduct.get(pId)!.push(variant._id);
    }

    console.log(`🗂️  Có ${variantsByProduct.size} sản phẩm cần được backfill\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const [productId, variantIds] of variantsByProduct.entries()) {
      try {
        const result = await productsCol.updateOne(
          { _id: new mongoose.Types.ObjectId(productId) },
          { $set: { variants: variantIds } }
        );

        if (result.matchedCount === 0) {
          console.warn(`⚠️  Product ${productId} không tồn tại trong DB — skip`);
          skipCount++;
        } else {
          console.log(`✅ Product ${productId} → ${variantIds.length} variant(s)`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Lỗi khi update product ${productId}:`, err);
        errorCount++;
      }
    }

    console.log('\n========================================');
    console.log(`🎉 Migration hoàn tất!`);
    console.log(`   ✅ Thành công : ${successCount} sản phẩm`);
    console.log(`   ⚠️  Bỏ qua    : ${skipCount} sản phẩm (không tìm thấy)`);
    console.log(`   ❌ Lỗi       : ${errorCount} sản phẩm`);
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateVariantsToProduct();
