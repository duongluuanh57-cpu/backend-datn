/**
 * Migration: Xóa field brandId khỏi collection order_items
 *
 * Chạy: npx tsx src/scripts/migrate-remove-brandid-from-order-items.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function removeBrandIdFromOrderItems() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';

  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const db = mongoose.connection.db!;
    const col = db.collection('order_items');

    // Kiểm tra
    const total = await col.countDocuments();
    const withBrandId = await col.countDocuments({ brandId: { $exists: true } });
    console.log(`📦 Tổng order_items       : ${total}`);
    console.log(`🏷️  Có field brandId       : ${withBrandId}\n`);

    if (withBrandId === 0) {
      console.log('ℹ️  Không có document nào còn brandId. Không cần migrate.');
      await mongoose.disconnect();
      return;
    }

    // Xóa field brandId
    const result = await col.updateMany(
      { brandId: { $exists: true } },
      { $unset: { brandId: '' } }
    );

    console.log(`✅ Đã xóa brandId khỏi ${result.modifiedCount} order_items\n`);

    // Verify
    const remaining = await col.countDocuments({ brandId: { $exists: true } });
    console.log(`🔍 Còn lại docs có brandId: ${remaining} (phải là 0)\n`);

    console.log('🎉 Migration hoàn tất!');
    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

removeBrandIdFromOrderItems();
