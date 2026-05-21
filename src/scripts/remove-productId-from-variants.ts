/**
 * Migration: Xóa field productId khỏi tất cả documents trong product_variants
 *
 * Sau khi đã backfill Product.variants[], field productId trong product_variants
 * không còn cần thiết nữa. Script này unset nó để DB sạch hoàn toàn.
 *
 * Chạy: node --strip-types src/scripts/remove-productId-from-variants.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function removeProductIdFromVariants() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';

  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const db = mongoose.connection.db!;
    const variantsCol = db.collection('product_variants');

    // Xóa unique index productId_1_size_1 nếu còn tồn tại trên DB
    try {
      await variantsCol.dropIndex('productId_1_size_1');
      console.log('🗑️  Đã xóa unique index productId_1_size_1\n');
    } catch (err: any) {
      if (err?.codeName === 'IndexNotFound' || err?.code === 27) {
        console.log('ℹ️  Index productId_1_size_1 không tồn tại, bỏ qua\n');
      } else {
        throw err;
      }
    }

    // Đếm trước
    const countBefore = await variantsCol.countDocuments({ productId: { $exists: true } });
    console.log(`📦 Tìm thấy ${countBefore} documents còn field productId\n`);

    if (countBefore === 0) {
      console.log('✅ Không có gì cần xóa. DB đã sạch rồi.');
      await mongoose.disconnect();
      return;
    }

    // Unset productId khỏi tất cả documents
    const result = await variantsCol.updateMany(
      { productId: { $exists: true } },
      { $unset: { productId: '' } }
    );

    console.log(`✅ Đã xóa field productId khỏi ${result.modifiedCount} documents`);

    // Verify
    const countAfter = await variantsCol.countDocuments({ productId: { $exists: true } });
    console.log(`🔍 Còn lại ${countAfter} documents có productId (phải là 0)\n`);

    console.log('========================================');
    console.log('🎉 Hoàn tất! product_variants đã sạch.');
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

removeProductIdFromVariants();
