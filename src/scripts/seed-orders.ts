/**
 * Script seed 3 orders mẫu với order_items riêng biệt
 */

import mongoose from 'mongoose';
import { Order } from '../models/Order.ts';
import { OrderItem } from '../models/OrderItem.ts';
import { Product } from '../models/Product.ts';
import { User } from '../models/User.ts';
import dotenv from 'dotenv';

dotenv.config();

async function seedOrders() {
  try {
    console.log('🌱 Bắt đầu seed Orders và OrderItems...\n');

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const tenantId = 'default';

    // Lấy một số sản phẩm từ database (bỏ qua tenantId vì các sản phẩm thực tế có tenantId 'default-tenant')
    let products = await Product.find({}).limit(5).lean();
    
    if (products.length === 0) {
      console.log('⚠️  Không tìm thấy sản phẩm. Đang lấy brand hoặc tạo brand mới...\n');
      
      let brand = await mongoose.connection.db.collection('brands').findOne({});
      if (!brand) {
        // Tạo brand mẫu
        const newBrand = await mongoose.connection.db.collection('brands').insertOne({
          tenantId: 'default-tenant',
          name: 'L\'essence Brand',
          description: 'Thương hiệu nước hoa cao cấp L\'essence',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        brand = { _id: newBrand.insertedId, name: 'L\'essence Brand' } as any;
        console.log('✅ Đã tạo brand mẫu mới');
      }

      // Tạo 5 sản phẩm mẫu với brandId hợp lệ
      const sampleProducts = await Product.insertMany([
        {
          tenantId: 'default-tenant',
          name: 'Chanel No.5 Eau de Parfum',
          brandId: brand._id,
          price: 3500000,
          image: '',
          description: 'Hương thơm huyền thoại của Chanel',
          size: '100ml',
          quantityInStock: 50,
          rating: 5,
          tag: 'New',
          gender: 'Nữ',
          concentration: 'Eau de Parfum',
          segment: 'Luxury'
        },
        {
          tenantId: 'default-tenant',
          name: 'Dior Sauvage',
          brandId: brand._id,
          price: 2800000,
          image: '',
          description: 'Hương thơm nam tính mạnh mẽ',
          size: '100ml',
          quantityInStock: 30,
          rating: 5,
          tag: 'Sale',
          gender: 'Nam',
          concentration: 'Eau de Toilette',
          segment: 'Premium'
        },
        {
          tenantId: 'default-tenant',
          name: 'Tom Ford Black Orchid',
          brandId: brand._id,
          price: 4200000,
          image: '',
          description: 'Hương thơm quyến rũ và bí ẩn',
          size: '50ml',
          quantityInStock: 20,
          rating: 5,
          gender: 'Unisex',
          concentration: 'Eau de Parfum',
          segment: 'Luxury'
        },
        {
          tenantId: 'default-tenant',
          name: 'Yves Saint Laurent Libre',
          brandId: brand._id,
          price: 3200000,
          image: '',
          description: 'Hương thơm tự do và hiện đại',
          size: '90ml',
          quantityInStock: 40,
          rating: 5,
          tag: 'New',
          gender: 'Nữ',
          concentration: 'Eau de Parfum',
          segment: 'Premium'
        },
        {
          tenantId: 'default-tenant',
          name: 'Versace Eros',
          brandId: brand._id,
          price: 2500000,
          image: '',
          description: 'Hương thơm nam tính cuốn hút',
          size: '100ml',
          quantityInStock: 35,
          rating: 5,
          gender: 'Nam',
          concentration: 'Eau de Toilette',
          segment: 'Premium'
        }
      ]);
      
      products = sampleProducts.map(p => p.toObject ? p.toObject() : p) as any;
      console.log(`✅ Đã tạo ${products.length} sản phẩm mẫu\n`);
    }

    console.log(`📦 Tìm thấy ${products.length} sản phẩm để tạo orders\n`);

    // Lấy user đầu tiên (nếu có)
    const user = await User.findOne({ tenantId }).lean();
    const userId = user?._id;

    // Xóa tất cả orders và order_items cũ
    await Order.deleteMany({});
    await OrderItem.deleteMany({});
    console.log('🗑️  Đã xóa tất cả orders và order_items cũ toàn bộ DB\n');

    // === ORDER 1: Delivered ===
    const order1 = await Order.create({
      tenantId,
      userId,
      customerName: user?.fullName || user?.username || 'Nguyễn Văn A',
      customerEmail: user?.email || 'nguyenvana@example.com',
      customerPhone: user?.phoneNumber || '0901234567',
      customerAddress: '123 Đường ABC, Quận 1, TP.HCM',
      status: 'delivered',
      paymentMethod: 'bank_transfer',
      paymentStatus: 'paid',
      totalAmount: (products[0].price * 2) + products[1].price,
      createdAt: new Date('2026-05-15T10:30:00.000Z')
    });

    const items1 = await OrderItem.insertMany([
      {
        tenantId,
        orderId: order1._id,
        productId: products[0]._id,
        brandId: products[0].brand ? undefined : undefined,
        name: products[0].name,
        brand: products[0].brand,
        quantity: 2,
        price: products[0].price,
        subTotal: products[0].price * 2,
        image: products[0].image || ''
      },
      {
        tenantId,
        orderId: order1._id,
        productId: products[1]._id,
        brandId: products[1].brand ? undefined : undefined,
        name: products[1].name,
        brand: products[1].brand,
        quantity: 1,
        price: products[1].price,
        subTotal: products[1].price * 1,
        image: products[1].image || ''
      }
    ]);

    await Order.updateOne(
      { _id: order1._id },
      { $set: { items: items1.map((i) => i._id) } }
    );

    console.log(`✅ Order 1: ${order1._id} - ${order1.status} - 2 items`);

    // === ORDER 2: Processing ===
    const order2 = await Order.create({
      tenantId,
      userId,
      customerName: user?.fullName || user?.username || 'Nguyễn Văn A',
      customerEmail: user?.email || 'tranthib@example.com',
      customerPhone: user?.phoneNumber || '0912345678',
      customerAddress: '456 Đường XYZ, Quận 3, TP.HCM',
      status: 'processing',
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
      totalAmount: products[2].price,
      createdAt: new Date('2026-05-18T14:20:00.000Z')
    });

    const item2 = await OrderItem.create({
      tenantId,
      orderId: order2._id,
      productId: products[2]._id,
      brandId: products[2].brand ? undefined : undefined,
      name: products[2].name,
      brand: products[2].brand,
      quantity: 1,
      price: products[2].price,
      subTotal: products[2].price * 1,
      image: products[2].image || ''
    });

    await Order.updateOne(
      { _id: order2._id },
      { $set: { items: [item2._id] } }
    );

    console.log(`✅ Order 2: ${order2._id} - ${order2.status} - 1 item`);

    // === ORDER 3: Pending ===
    const order3 = await Order.create({
      tenantId,
      userId,
      customerName: user?.fullName || user?.username || 'Nguyễn Văn A',
      customerEmail: user?.email || 'levanc@example.com',
      customerPhone: user?.phoneNumber || '0923456789',
      customerAddress: '789 Đường DEF, Quận 7, TP.HCM',
      status: 'pending',
      paymentMethod: 'momo',
      paymentStatus: 'unpaid',
      totalAmount: products[0].price + (products[3].price * 3) + products[4].price,
      createdAt: new Date('2026-05-19T09:15:00.000Z')
    });

    const items3 = await OrderItem.insertMany([
      {
        tenantId,
        orderId: order3._id,
        productId: products[0]._id,
        brandId: products[0].brand ? undefined : undefined,
        name: products[0].name,
        brand: products[0].brand,
        quantity: 1,
        price: products[0].price,
        subTotal: products[0].price * 1,
        image: products[0].image || ''
      },
      {
        tenantId,
        orderId: order3._id,
        productId: products[3]._id,
        brandId: products[3].brand ? undefined : undefined,
        name: products[3].name,
        brand: products[3].brand,
        quantity: 3,
        price: products[3].price,
        subTotal: products[3].price * 3,
        image: products[3].image || ''
      },
      {
        tenantId,
        orderId: order3._id,
        productId: products[4]._id,
        brandId: products[4].brand ? undefined : undefined,
        name: products[4].name,
        brand: products[4].brand,
        quantity: 1,
        price: products[4].price,
        subTotal: products[4].price * 1,
        image: products[4].image || ''
      }
    ]);

    await Order.updateOne(
      { _id: order3._id },
      { $set: { items: items3.map((i) => i._id) } }
    );

    console.log(`✅ Order 3: ${order3._id} - ${order3.status} - 3 items`);

    console.log('\n🎉 Seed hoàn tất!');
    console.log('📊 Đã tạo: 3 orders và 6 order_items\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedOrders();
