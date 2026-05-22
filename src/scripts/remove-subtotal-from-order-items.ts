/**
 * remove-subtotal-from-order-items.ts
 *
 * Xoá field `subTotal` khỏi tất cả documents trong order_items collection
 * Chạy: npx tsx src/scripts/remove-subtotal-from-order-items.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI chưa được set. Kiểm tra file .env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log(`✅ Đã kết nối MongoDB`);

  // Dùng raw driver để $unset
  const db = mongoose.connection.db;
  if (!db) {
    console.error('❌ Không lấy được db instance');
    process.exit(1);
  }

  const collection = db.collection('order_items');

  // Đếm số documents có subTotal
  const count = await collection.countDocuments({ subTotal: { $exists: true } });
  console.log(`📦 Tìm thấy ${count} order items có field subTotal`);

  if (count > 0) {
    const result = await collection.updateMany(
      { subTotal: { $exists: true } },
      { $unset: { subTotal: '' } }
    );
    console.log(`✅ Đã xoá subTotal khỏi ${result.modifiedCount} documents`);
  }

  console.log('🎉 Hoàn tất!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});