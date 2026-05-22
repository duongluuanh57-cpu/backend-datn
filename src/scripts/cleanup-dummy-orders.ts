import mongoose from 'mongoose';
import { Order } from '../models/Order.ts';
import { OrderItem } from '../models/OrderItem.ts';
import dotenv from 'dotenv';

dotenv.config();

const DUMMY_NAMES = [
  "Nước hoa L'essence Royal Amber - 100ml",
  'Midnight Rose Gold - 50ml',
  'Imperial Leather & Suede - 100ml',
];

async function cleanupDummyOrders() {
  try {
    console.log('🧹 Bắt đầu dọn dẹp Order dummy...\n');

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const itemsToDelete = await OrderItem.find({ name: { $in: DUMMY_NAMES } }).lean();
    console.log(`📦 Tìm thấy ${itemsToDelete.length} OrderItem dummy`);

    if (itemsToDelete.length === 0) {
      console.log('✅ Không có OrderItem dummy nào để xóa\n');
    } else {
      const itemIds = itemsToDelete.map((item) => item._id);

      // Tìm các Order có items trỏ tới các OrderItem này
      const ordersWithItems = await Order.find({ items: { $in: itemIds } }).lean();
      console.log(`📦 Tìm thấy ${ordersWithItems.length} Order liên quan`);

      // Xóa các OrderItem dummy
      const deletedItems = await OrderItem.deleteMany({ _id: { $in: itemIds } });
      console.log(`🗑️  Đã xóa ${deletedItems.deletedCount} OrderItem`);

      // Xóa các Order liên quan
      const orderIds = ordersWithItems.map((order) => order._id);
      const deletedOrders = await Order.deleteMany({ _id: { $in: orderIds } });
      console.log(`🗑️  Đã xóa ${deletedOrders.deletedCount} Order`);
    }

    // Dọn thêm các Order còn sót có items rỗng (nếu có)
    const emptyOrders = await Order.find({ $or: [{ items: { $size: 0 } }, { items: null }] }).lean();
    if (emptyOrders.length > 0) {
      const emptyIds = emptyOrders.map((o) => o._id);
      const deleted = await Order.deleteMany({ _id: { $in: emptyIds } });
      console.log(`🗑️  Đã xóa thêm ${deleted.deletedCount} Order có items rỗng`);
    }

    console.log('\n✅ Dọn dẹp hoàn tất!\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB\n');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

cleanupDummyOrders();
