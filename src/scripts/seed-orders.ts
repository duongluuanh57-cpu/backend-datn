import mongoose from 'mongoose';
import { Order } from '../models/Order.ts';
import { connectDB } from '../config/database.ts';
import 'dotenv/config';

const seedOrders = async () => {
  try {
    await connectDB();
    console.log('Connected to DB for seeding...');

    const tenantId = 'default';
    
    // Xóa đơn cũ trong ngày để test cho sạch
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await Order.deleteMany({ tenantId, createdAt: { $gte: today } });

    const orders = [
      {
        tenantId,
        customerName: 'Nguyễn Văn A',
        customerEmail: 'a@example.com',
        totalAmount: 1200000,
        status: 'processing',
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: 'Nước hoa Velvet Jasmine',
            quantity: 1,
            price: 1200000,
            image: 'https://i.ibb.co/C3Y4Vv7Y/perfume2.webp'
          }
        ]
      },
      {
        tenantId,
        customerName: 'Trần Thị B',
        customerEmail: 'b@example.com',
        totalAmount: 2500000,
        status: 'pending',
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: 'Nước hoa Midnight Rose',
            quantity: 1,
            price: 2500000,
            image: 'https://i.ibb.co/qFf0N0kH/perfume1.webp'
          }
        ]
      },
      {
        tenantId,
        customerName: 'Lê Văn C',
        customerEmail: 'c@example.com',
        totalAmount: 800000,
        status: 'delivered',
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: 'Nước hoa Summer Breeze',
            quantity: 1,
            price: 800000,
            image: 'https://i.ibb.co/VWV0pP0p/perfume3.webp'
          }
        ]
      }
    ];

    await Order.insertMany(orders);
    console.log('✅ Seeded 3 orders for today!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding orders:', err);
    process.exit(1);
  }
};

seedOrders();
