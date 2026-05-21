/**
 * Fix: Backfill productId cho tất cả ProductSEO records
 *
 * Vấn đề: Migration cũ đã xóa productId khỏi product_seo collection
 * Giải pháp: Lấy productId từ Product collection và gán lại cho SEO records
 *
 * Chạy: node --strip-types src/scripts/fix-seo-productId.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixSeoProductId() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';

  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const db = mongoose.connection.db!;
    const seoCol = db.collection('product_seo');
    const productsCol = db.collection('products');

    // Lấy tất cả products
    const allProducts = await productsCol.find({}, { projection: { _id: 1, name: 1, tenantId: 1 } }).toArray();
    console.log(`📦 Có ${allProducts.length} products trong database\n`);

    // Lấy tất cả SEO records
    const allSeo = await seoCol.find({}).toArray();
    console.log(`🔍 Có ${allSeo.length} SEO records trong database\n`);

    // Kiểm tra SEO records nào đã có productId
    const seoWithProductId = allSeo.filter(s => s.productId);
    const seoWithoutProductId = allSeo.filter(s => !s.productId);

    console.log(`✅ SEO đã có productId: ${seoWithProductId.length}`);
    console.log(`❌ SEO thiếu productId: ${seoWithoutProductId.length}\n`);

    // Tạo map: seoId -> product (dựa trên tenantId và các field trùng khớp)
    let fixedCount = 0;
    let alreadyOkCount = 0;
    let notFoundCount = 0;

    // Với các SEO không có productId, thử match với product
    for (const seoDoc of seoWithoutProductId) {
      try {
        // Tìm product có cùng tenantId và có thể match theo tên (nếu có metaTitle)
        const matchingProduct = allProducts.find(p => {
          if (p.tenantId !== seoDoc.tenantId) return false;
          // Nếu SEO có metaTitle, thử match với tên product
          if (seoDoc.metaTitle && p.name) {
            return p.name.toLowerCase().includes(seoDoc.metaTitle.toLowerCase().substring(0, 20)) ||
                   seoDoc.metaTitle.toLowerCase().includes(p.name.toLowerCase().substring(0, 20));
          }
          return false;
        });

        if (matchingProduct) {
          await seoCol.updateOne(
            { _id: seoDoc._id },
            { $set: { productId: matchingProduct._id } }
          );
          console.log(`✅ SEO ${seoDoc._id} → productId: ${matchingProduct._id} (${matchingProduct.name})`);
          fixedCount++;
        } else {
          console.log(`⚠️  Không tìm thấy product cho SEO ${seoDoc._id} (tenantId: ${seoDoc.tenantId})`);
          notFoundCount++;
        }
      } catch (err) {
        console.error(`❌ Lỗi khi fix SEO ${seoDoc._id}:`, err);
      }
    }

    // Tạo SEO records cho products chưa có
    console.log('\n--- Tạo SEO records cho products chưa có ---\n');
    let createdCount = 0;

    for (const product of allProducts) {
      const hasSeo = allSeo.some(s => {
        // Kiểm tra theo productId (nếu có)
        if (s.productId && s.productId.toString() === product._id.toString()) return true;
        return false;
      });

      if (!hasSeo) {
        await seoCol.insertOne({
          tenantId: product.tenantId,
          productId: product._id,
          metaTitle: '',
          metaDescription: '',
          keywords: [],
          slug: '',
          ogTitle: '',
          ogDescription: '',
          ogImage: '',
          canonicalUrl: '',
          priceReport: '',
          sizeReport: '',
          discountReport: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`✅ Tạo SEO record cho product: ${product.name} (${product._id})`);
        createdCount++;
      }
    }

    console.log('\n========================================');
    console.log('🎉 Fix hoàn tất!');
    console.log(`   ✅ Đã fix productId: ${fixedCount} SEO records`);
    console.log(`   ⚠️  Không tìm được product: ${notFoundCount} SEO records`);
    console.log(`   ➕ Đã tạo mới SEO records: ${createdCount}`);
    console.log(`   ✔️  Đã có productId từ trước: ${alreadyOkCount}`);
    console.log('========================================\n');

    // Verify
    const finalSeoCount = await seoCol.countDocuments({ productId: { $exists: true } });
    console.log(`🔍 Tổng SEO records có productId: ${finalSeoCount}`);

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixSeoProductId();
