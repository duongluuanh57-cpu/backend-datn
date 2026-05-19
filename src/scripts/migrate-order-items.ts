/**
 * Migration Script: Chuyển OrderItem từ collection riêng sang embedded items trong Order
 * 
 * Script này sẽ:
 * 1. Lấy tất cả orders có items là ObjectId references
 * 2. Populate OrderItem data
 * 3. Chuyển thành embedded items array
 * 4. Cập nhật Order documents
 */

import mongoose from 'mongoose';
import { Order } from '../models/Order.ts';
import { OrderItem } from '../models/OrderItem.ts';
import dotenv from 'dotenv';

dotenv.config();

async function migrateOrderItems() {
  try {
    console.log('🚀 Bắt đầu migration Order Items...\n');

    // Kết nối MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    // Lấy tất cả orders
    const orders = await Order.find({}).lean();
    console.log(`📊 Tìm thấy ${orders.length} đơn hàng\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      try {
        // Kiểm tra xem items đã là array of objects chưa
        if (order.items && order.items.length > 0) {
          const firstItem = order.items[0];
          
          // Nếu đã là object (có name, price, quantity) thì skip
          if (typeof firstItem === 'object' && 'name' in firstItem && 'price' in firstItem) {
            console.log(`⏭️  Skip: Order ${order._id} - Items đã là embedded`);
            skipCount++;
            continue;
          }

          // Nếu là ObjectId references, cần migrate
          if (mongoose.Types.ObjectId.isValid(firstItem)) {
            const itemIds = order.items as mongoose.Types.ObjectId[];
            const orderItems = await OrderItem.find({ _id: { $in: itemIds } }).lean();

            if (orderItems.length === 0) {
              console.log(`⚠️  Warning: Order ${order._id} - Không tìm thấy OrderItems`);
              skipCount++;
              continue;
            }

            // Chuyển đổi sang embedded format
            const embeddedItems = orderItems.map(item => ({
              productId: item.productId,
              name: item.name || 'Unknown Product',
              quantity: item.quantity,
              price: item.price,
              image: item.image || ''
            }));

            // Cập nhật order
            await Order.updateOne(
              { _id: order._id },
              { $set: { items: embeddedItems } }
            );

            successCount++;
            console.log(`✅ Migrated: Order ${order._id} - ${embeddedItems.length} items`);
          }
        } else {
          console.log(`⏭️  Skip: Order ${order._id} - Không có items`);
          skipCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating order ${order._id}:`, error);
      }
    }

    // Tổng kết
    console.log('\n' + '='.repeat(60));
    console.log('📈 KẾT QUẢ MIGRATION:');
    console.log('='.repeat(60));
    console.log(`✅ Thành công: ${successCount}`);
    console.log(`⏭️  Đã tồn tại/Skip: ${skipCount}`);
    console.log(`❌ Lỗi: ${errorCount}`);
    console.log(`📊 Tổng cộng: ${orders.length}`);
    console.log('='.repeat(60) + '\n');

    // Optional: Xóa OrderItem collection sau khi migrate (uncomment nếu muốn)
    // console.log('\n🗑️  Đang xóa OrderItem collection...');
    // await mongoose.connection.db.dropCollection('order_items');
    // console.log('✅ Đã xóa OrderItem collection\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');
    console.log('🎉 Migration hoàn tất!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Chạy migration
migrateOrderItems();
