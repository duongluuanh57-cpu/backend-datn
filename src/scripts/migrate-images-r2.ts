import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Product } from '../models/Product.ts';
import { Brand } from '../models/Brand.ts';
import { ImageService } from '../services/ImageService.ts';

dotenv.config();

async function migrateImagesToR2() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI is not defined in environment variables');
      process.exit(1);
    }

    console.log('📡 Đang kết nối tới MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('🍃 MongoDB: Kết nối thành công!');

    // Kiểm tra cấu hình Cloudflare R2
    const r2Configured = 
      process.env.CLOUDFLARE_ACCOUNT_ID && 
      process.env.R2_ACCESS_KEY_ID && 
      process.env.R2_SECRET_ACCESS_KEY && 
      process.env.R2_PUBLIC_DOMAIN;

    if (!r2Configured) {
      console.error('❌ Chưa cấu hình đầy đủ thông tin Cloudflare R2 trong file .env!');
      process.exit(1);
    }

    console.log('☁️ Đã phát hiện cấu hình Cloudflare R2. Bắt đầu quét cơ sở dữ liệu...');

    // 1. Quét Products
    const products = await Product.find({
      $or: [
        { image: /ibb\.co/i },
        { image: /imgbb\.com/i }
      ]
    });
    console.log(`📦 Tìm thấy ${products.length} sản phẩm đang sử dụng ảnh ImgBB.`);

    let migratedProducts = 0;
    for (const product of products) {
      console.log(`\n🔄 Đang xử lý sản phẩm: "${product.name}"`);
      console.log(`🔗 Link cũ: ${product.image}`);
      try {
        // Tải ảnh về
        const response = await fetch(product.image);
        if (!response.ok) {
          throw new Error(`Không thể tải ảnh từ URL: ${product.image} (HTTP ${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload lên R2 thông qua ImageService
        console.log(`📤 Đang nén WebP và tải lên Cloudflare R2...`);
        const uploadResult = await ImageService.compressAndUploadToR2(buffer, {
          name: product.name,
          maxWidth: 1920,
          quality: 80
        });

        // Cập nhật DB
        product.image = uploadResult.url;
        await product.save();
        migratedProducts++;
        console.log(`✅ Thành công! Link mới: ${uploadResult.url}`);
      } catch (err) {
        console.error(`❌ Lỗi khi xử lý sản phẩm "${product.name}":`, err);
      }
    }

    // 2. Quét Brands
    const brands = await Brand.find({
      $or: [
        { logo: /ibb\.co/i },
        { logo: /imgbb\.com/i }
      ]
    });
    console.log(`\n🏷️ Tìm thấy ${brands.length} thương hiệu đang sử dụng logo ImgBB.`);

    let migratedBrands = 0;
    for (const brand of brands) {
      if (!brand.logo) continue;
      console.log(`\n🔄 Đang xử lý thương hiệu: "${brand.name}"`);
      console.log(`🔗 Link cũ: ${brand.logo}`);
      try {
        // Tải ảnh về
        const response = await fetch(brand.logo);
        if (!response.ok) {
          throw new Error(`Không thể tải logo từ URL: ${brand.logo} (HTTP ${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload lên R2
        console.log(`📤 Đang nén WebP và tải lên Cloudflare R2...`);
        const uploadResult = await ImageService.compressAndUploadToR2(buffer, {
          name: brand.name,
          maxWidth: 800, // Logo nhỏ hơn sản phẩm
          quality: 85
        });

        // Cập nhật DB
        brand.logo = uploadResult.url;
        await brand.save();
        migratedBrands++;
        console.log(`✅ Thành công! Link mới: ${uploadResult.url}`);
      } catch (err) {
        console.error(`❌ Lỗi khi xử lý thương hiệu "${brand.name}":`, err);
      }
    }

    console.log(`\n🏁 DI CƯ HÌNH ẢNH HOÀN TẤT!`);
    console.log(`📦 Sản phẩm đã chuyển đổi: ${migratedProducts}/${products.length}`);
    console.log(`🏷️ Thương hiệu đã chuyển đổi: ${migratedBrands}/${brands.length}`);

    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối cơ sở dữ liệu.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi nghiêm trọng khi di cư ảnh:', err);
    process.exit(1);
  }
}

migrateImagesToR2();
