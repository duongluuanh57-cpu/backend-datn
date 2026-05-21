/**
 * Seed: Tạo dữ liệu mẫu cho ProductSEO
 *
 * Script này sẽ:
 * 1. Lấy tất cả products từ database
 * 2. Tạo SEO record cho mỗi product (nếu chưa có)
 * 3. Điền dữ liệu SEO mẫu dựa trên tên product
 *
 * Chạy: node --strip-types src/scripts/seed-product-seo.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Helper slugify tiếng Việt
function slugify(text: string): string {
  const vietnameseMap: Record<string, string> = {
    à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a',
    ă: 'a', ắ: 'a', ằ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
    â: 'a', ấ: 'a', ầ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
    è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
    ê: 'e', ế: 'e', ề: 'e', ể: 'e', ễ: 'e', ệ: 'e',
    ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
    ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o',
    ô: 'o', ố: 'o', ồ: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
    ơ: 'o', ớ: 'o', ờ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
    ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
    ư: 'u', ứ: 'u', ừ: 'u', ử: 'u', ữ: 'u', ự: 'u',
    ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
    đ: 'd',
  };

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\u0000-\u007E]/g, (char) => vietnameseMap[char] ?? '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '') || `product-${Date.now()}`;
}

async function seedProductSeo() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';

  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    const db = mongoose.connection.db!;
    const seoCol = db.collection('product_seo');
    const productsCol = db.collection('products');
    const brandsCol = db.collection('brands');

    // Lấy tất cả products
    const allProducts = await productsCol.find({}).toArray();
    console.log(`📦 Có ${allProducts.length} products cần xử lý\n`);

    // Lấy tất cả brands để map tên
    const allBrands = await brandsCol.find({}).toArray();
    const brandMap = new Map<string, string>();
    for (const brand of allBrands) {
      brandMap.set(brand._id.toString(), brand.name);
    }

    // Lấy tất cả SEO records hiện có
    const allSeo = await seoCol.find({}).toArray();
    console.log(`🔍 Có ${allSeo.length} SEO records hiện tại\n`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const product of allProducts) {
      const productId = product._id;
      const tenantId = product.tenantId;
      const productName = product.name || '';
      const brandName = brandMap.get(product.brandId?.toString()) || '';
      const description = product.description || '';

      // Tìm SEO record đã có cho product này
      const existingSeo = allSeo.find(s => 
        s.productId && s.productId.toString() === productId.toString()
      );

      // Tạo dữ liệu SEO mẫu
      const seoData = {
        metaTitle: existingSeo?.metaTitle || `${productName} - ${brandName} | L'essence Premium Store`,
        metaDescription: existingSeo?.metaDescription || `Khám phá ${productName} từ thương hiệu ${brandName}. ${description.substring(0, 100)}...`,
        keywords: existingSeo?.keywords?.length > 0 
          ? existingSeo.keywords 
          : [productName, brandName, 'nước hoa', 'perfume', 'chính hãng', 'L\'essence'],
        slug: existingSeo?.slug || slugify(productName),
        ogTitle: existingSeo?.ogTitle || `${productName} - ${brandName}`,
        ogDescription: existingSeo?.ogDescription || description.substring(0, 150) || `Khám phá ${productName} từ ${brandName}`,
        ogImage: existingSeo?.ogImage || '',
        canonicalUrl: existingSeo?.canonicalUrl || `/products/${slugify(productName)}`,
        priceReport: existingSeo?.priceReport || '',
        sizeReport: existingSeo?.sizeReport || '',
        discountReport: existingSeo?.discountReport || '',
      };

      if (existingSeo) {
        // Update SEO record đã có
        const hasChanges = Object.entries(seoData).some(([key, value]) => {
          if (key === 'keywords') {
            return JSON.stringify((existingSeo as any)[key] || []) !== JSON.stringify(value);
          }
          return (existingSeo as any)[key] !== value;
        });

        if (hasChanges) {
          await seoCol.updateOne(
            { _id: existingSeo._id },
            { 
              $set: { 
                ...seoData, 
                productId,
                tenantId,
                updatedAt: new Date() 
              } 
            }
          );
          console.log(`✅ Updated SEO: ${productName}`);
          updatedCount++;
        } else {
          // Đảm bảo productId có mặt
          if (!existingSeo.productId) {
            await seoCol.updateOne(
              { _id: existingSeo._id },
              { $set: { productId, updatedAt: new Date() } }
            );
            console.log(`✅ Added productId: ${productName}`);
            updatedCount++;
          } else {
            skippedCount++;
          }
        }
      } else {
        // Tạo SEO record mới
        await seoCol.insertOne({
          tenantId,
          productId,
          ...seoData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`✅ Created SEO: ${productName}`);
        createdCount++;
      }
    }

    console.log('\n========================================');
    console.log('🎉 Seed hoàn tất!');
    console.log(`   ➕ Đã tạo mới: ${createdCount} SEO records`);
    console.log(`   🔄 Đã cập nhật: ${updatedCount} SEO records`);
    console.log(`   ✔️  Đã bỏ qua: ${skippedCount} SEO records`);
    console.log('========================================\n');

    // Verify
    const finalSeoCount = await seoCol.countDocuments({ productId: { $exists: true } });
    const finalProductCount = await productsCol.countDocuments({});
    console.log(`🔍 Tổng products: ${finalProductCount}`);
    console.log(`🔍 Tổng SEO records có productId: ${finalSeoCount}`);
    console.log(`📊 Coverage: ${((finalSeoCount / finalProductCount) * 100).toFixed(1)}%`);

    await mongoose.disconnect();
    console.log('\n✅ Đã ngắt kết nối MongoDB');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedProductSeo();
