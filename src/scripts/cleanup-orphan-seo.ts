/**
 * Cleanup: Xóa các SEO docs không có product tương ứng (orphans)
 *
 * Chạy: node --strip-types src/scripts/cleanup-orphan-seo.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupOrphanSeo() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';

  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const db = mongoose.connection.db!;
    const seoCol = db.collection('product_seo');
    const productsCol = db.collection('products');

    // Lấy tất cả product _ids hiện có
    const allProducts = await productsCol.find({}, { projection: { _id: 1, seoId: 1 } }).toArray();
    const validSeoIds = new Set(
      allProducts.map(p => p.seoId?.toString()).filter(Boolean)
    );

    console.log(`📦 Có ${allProducts.length} products, ${validSeoIds.size} có seoId\n`);

    // Tìm SEO docs không được trỏ tới bởi bất kỳ product nào
    const allSeo = await seoCol.find({}).toArray();
    const orphanIds = allSeo
      .filter(s => !validSeoIds.has(s._id.toString()))
      .map(s => s._id);

    console.log(`🗑️  Tìm thấy ${orphanIds.length} orphan SEO docs\n`);

    if (orphanIds.length === 0) {
      console.log('✅ Không có orphan nào. DB đã sạch.');
      await mongoose.disconnect();
      return;
    }

    // Xóa orphans
    const result = await seoCol.deleteMany({ _id: { $in: orphanIds } });
    console.log(`✅ Đã xóa ${result.deletedCount} orphan SEO docs`);

    const remaining = await seoCol.countDocuments();
    console.log(`🔍 Còn lại ${remaining} SEO docs (phải bằng số products có seoId)\n`);

    console.log('========================================');
    console.log('🎉 Cleanup hoàn tất!');
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

cleanupOrphanSeo();
