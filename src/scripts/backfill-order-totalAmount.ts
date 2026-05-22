/**
 * backfill-order-totalAmount.ts
 *
 * Tính lại totalAmount cho tất cả orders dựa trên (price * quantity) của từng order item
 * Chạy: npx tsx src/scripts/backfill-order-totalAmount.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI chưa được set');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Đã kết nối MongoDB');

  const db = mongoose.connection.db!;
  const ordersColl = db.collection('orders');
  const itemsColl = db.collection('order_items');

  const orders = await ordersColl.find({}).toArray();
  console.log(`📦 Tìm thấy ${orders.length} orders`);

  let updated = 0;
  for (const order of orders) {
    const items = await itemsColl.find({ orderId: order._id }).toArray();
    if (items.length === 0) continue;

    const totalAmount = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);

    await ordersColl.updateOne(
      { _id: order._id },
      { $set: { totalAmount } }
    );
    updated++;
    console.log(`   ✅ Order ${order._id} → ${totalAmount}`);
  }

  console.log(`\n🎉 Đã cập nhật totalAmount cho ${updated}/${orders.length} orders`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});