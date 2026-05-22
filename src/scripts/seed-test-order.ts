import mongoose from 'mongoose';
import { Order } from '../models/Order.ts';
import { OrderItem } from '../models/OrderItem.ts';
import { User } from '../models/User.ts';
import dotenv from 'dotenv';

dotenv.config();

async function seedTestOrder() {
  try {
    console.log('🌱 Seed 1 order test cho ngogiabao...\n');

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    // Tìm user
    const user = await User.findOne({ email: 'ngogiabao762006@gmail.com' }).lean();
    if (!user) {
      console.log('❌ Không tìm thấy user với email ngogiabao762006@gmail.com');
      process.exit(1);
    }
    console.log(`✅ User: ${user.username} (${user._id})\n`);

    const tenantId = user.tenantId || 'default';

    // Tìm sp Jean Paul Gaultier Scandal Pour Homme Intense EDP
    const db = mongoose.connection.db;
    const product = await db.collection('products').findOne({ name: 'Jean Paul Gaultier Scandal Pour Homme Intense EDP' });
    if (!product) {
      console.log('❌ Không tìm thấy sản phẩm');
      process.exit(1);
    }
    console.log(`✅ Sản phẩm: ${product.name} (${product._id})`);

    // Tìm variants
    const variants = await db.collection('product_variants').find({ productId: product._id }).toArray();
    console.log(`✅ Variants: ${variants.length} size`);

    // Tìm ảnh
    const images = await db.collection('product_images').find({ productId: product._id }).limit(1).toArray();
    const imageUrl = images.length > 0 ? images[0].url : '';

    // Lấy brand name
    const brand = await db.collection('brands').findOne({ _id: product.brandId });
    const brandName = brand?.name || 'Jean Paul Gaultier';

    // Xóa order cũ của user này để không bị trùng
    await Order.deleteMany({ userId: user._id, tenantId });
    await OrderItem.deleteMany({ orderId: { $in: (await Order.find({ userId: user._id, tenantId }).lean()).map((o: any) => o._id) } });
    console.log('🗑️  Đã xóa order cũ của user');

    // Tạo 1 order với 1 item (50ml)
    const variant50ml = variants.find((v: any) => v.size === '50ml');
    const variantPrice = variant50ml?.price || product.price;
    const variantSize = variant50ml?.size || '50ml';

    const order = await Order.create({
      tenantId,
      userId: user._id,
      customerName: user.fullName || user.username,
      customerEmail: user.email,
      customerPhone: (user as any).phoneNumber || '0901234567',
      totalAmount: variantPrice,
      status: 'delivered',
      paymentMethod: 'bank_transfer',
      paymentStatus: 'paid',
      createdAt: new Date('2026-05-20T10:30:00.000Z'),
    });
    console.log(`✅ Order: ${order._id}`);

    const item = await OrderItem.create({
      tenantId,
      orderId: order._id,
      productId: product._id,
      name: product.name,
      brand: brandName,
      quantity: 1,
      price: variantPrice,
      subTotal: variantPrice,
      image: imageUrl,
    });
    console.log(`✅ OrderItem: ${item._id} - ${item.name} (${variantSize}) - ${variantPrice.toLocaleString('vi-VN')}đ`);

    // Gắn items vào order
    await Order.updateOne({ _id: order._id }, { $set: { items: [item._id] } });
    console.log('✅ Đã gắn item vào order\n');

    console.log('🎉 Seed hoàn tất!');
    console.log(`📊 1 order: ${order._id}`);
    console.log(`   → 1 item: ${item.name} (${variantSize})`);
    console.log(`   → Image: ${imageUrl.substring(0, 80)}...\n`);

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedTestOrder();
