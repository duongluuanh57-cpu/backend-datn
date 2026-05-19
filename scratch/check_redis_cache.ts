/**
 * Script kiểm tra Redis cache để xem có sản phẩm nào được cache không đúng
 * Chạy: npx tsx scratch/check_redis_cache.ts
 */

import 'dotenv/config';
import { redis } from '../src/config/redis.ts';

async function checkRedisCache() {
  try {
    console.log('🔍 Đang kiểm tra Redis cache...\n');

    // 1. Kiểm tra tất cả keys liên quan đến product
    console.log('📦 1. Checking product-related cache keys:');
    const productKeys = await redis.keys('products:*');
    console.log(`   Found ${productKeys.length} product cache keys:`);
    for (const key of productKeys) {
      const ttl = await redis.ttl(key);
      console.log(`   - ${key} (TTL: ${ttl}s)`);
    }
    console.log('');

    // 2. Kiểm tra AI cache
    console.log('🤖 2. Checking AI cache keys:');
    const aiKeys = await redis.keys('ai_*');
    console.log(`   Found ${aiKeys.length} AI cache keys:`);
    for (const key of aiKeys.slice(0, 10)) { // Chỉ hiển thị 10 keys đầu
      const ttl = await redis.ttl(key);
      console.log(`   - ${key} (TTL: ${ttl}s)`);
    }
    if (aiKeys.length > 10) {
      console.log(`   ... and ${aiKeys.length - 10} more`);
    }
    console.log('');

    // 3. Kiểm tra xem có cache nào chứa product data không
    console.log('🔎 3. Checking for cached product data:');
    for (const key of productKeys) {
      const data = await redis.get(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            console.log(`   ${key}: Contains ${parsed.length} products`);
            if (parsed.length > 0) {
              console.log(`      First product: ${parsed[0].name || 'N/A'}`);
            }
          } else {
            console.log(`   ${key}: Contains single product: ${parsed.name || 'N/A'}`);
          }
        } catch (e) {
          console.log(`   ${key}: Not JSON data`);
        }
      }
    }
    console.log('');

    // 4. Kiểm tra AI autocomplete cache
    console.log('💡 4. Checking AI autocomplete cache:');
    const autocompleteKeys = await redis.keys('ai_autocomplete_cache:*');
    console.log(`   Found ${autocompleteKeys.length} autocomplete cache keys`);
    console.log('');

    // 5. Kiểm tra AI price cache
    console.log('💰 5. Checking AI price cache:');
    const priceKeys = await redis.keys('ai_price_cache:*');
    console.log(`   Found ${priceKeys.length} price cache keys`);
    console.log('');

    // 6. Tổng kết
    console.log('📊 Summary:');
    console.log(`   Total product cache keys: ${productKeys.length}`);
    console.log(`   Total AI cache keys: ${aiKeys.length}`);
    console.log(`   Total autocomplete cache keys: ${autocompleteKeys.length}`);
    console.log(`   Total price cache keys: ${priceKeys.length}`);
    console.log('');

    // 7. Kiểm tra memory usage
    const info = await redis.info('memory');
    const usedMemory = info.match(/used_memory_human:(.+)/)?.[1];
    console.log(`💾 Redis Memory Usage: ${usedMemory}`);
    console.log('');

    console.log('✅ Cache check completed!');
    console.log('');
    console.log('📝 Notes:');
    console.log('   - Product cache (products:*) chỉ cache danh sách sản phẩm để hiển thị');
    console.log('   - AI cache (ai_*) chỉ cache kết quả AI generation để tránh gọi lại');
    console.log('   - KHÔNG có cache nào tự động tạo sản phẩm vào database');
    console.log('   - Sản phẩm chỉ được tạo khi user bấm nút "Lưu" trong form');

  } catch (error) {
    console.error('❌ Error checking Redis cache:', error);
  } finally {
    await redis.quit();
  }
}

checkRedisCache();
