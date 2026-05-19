/**
 * Script kiểm tra cấu trúc Orders trong database
 */

import mongoose from 'mongoose';
import { Order } from '../models/Order.ts';
import dotenv from 'dotenv';

dotenv.config();

async function checkOrders() {
  try {
    console.log('🔍 Đang kiểm tra Orders...\n');

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    // Lấy 5 orders đầu tiên
    const orders = await Order.find({}).limit(5).lean();
    
    console.log(`📊 Tìm thấy ${orders.length} orders (hiển thị 5 đầu tiên):\n`);
    
    orders.forEach((order, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Order #${index + 1}:`);
      console.log(`${'='.repeat(60)}`);
      console.log(`_id: ${order._id}`);
      console.log(`tenantId: ${order.tenantId}`);
      console.log(`userId: ${order.userId || 'N/A'}`);
      console.log(`customerName: ${order.customerName}`);
      console.log(`totalAmount: ${order.totalAmount}`);
      console.log(`status: ${order.status}`);
      console.log(`\nItems (${order.items?.length || 0}):`);
      
      if (order.items && order.items.length > 0) {
        order.items.forEach((item: any, idx: number) => {
          console.log(`  ${idx + 1}. ${item.name}`);
          console.log(`     - productId: ${item.productId}`);
          console.log(`     - quantity: ${item.quantity}`);
          console.log(`     - price: ${item.price.toLocaleString('vi-VN')}đ`);
          console.log(`     - image: ${item.image || 'N/A'}`);
        });
      } else {
        console.log('  (Chưa có items)');
      }
      
      console.log(`\ncreatedAt: ${order.createdAt}`);
    });

    console.log(`\n${'='.repeat(60)}\n`);

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB\n');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkOrders();
