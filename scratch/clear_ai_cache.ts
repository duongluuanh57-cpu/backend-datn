/**
 * Script để clear AI cache trong Redis
 * Chạy: npx tsx scratch/clear_ai_cache.ts
 */

import 'dotenv/config';
import { redis } from '../src/config/redis.ts';

async function clearAICache() {
  try {
    console.log('🧹 Đang clear AI cache...\n');

    // 1. Clear AI autocomplete cache
    console.log('💡 1. Clearing AI autocomplete cache...');
    const autocompleteKeys = await redis.keys('ai_autocomplete_cache:*');
    if (autocompleteKeys.length > 0) {
      await redis.del(...autocompleteKeys);
      console.log(`   ✅ Deleted ${autocompleteKeys.length} autocomplete cache keys`);
    } else {
      console.log('   ℹ️  No autocomplete cache keys found');
    }
    console.log('');

    // 2. Clear AI price cache
    console.log('💰 2. Clearing AI price cache...');
    const priceKeys = await redis.keys('ai_price_cache:*');
    if (priceKeys.length > 0) {
      await redis.del(...priceKeys);
      console.log(`   ✅ Deleted ${priceKeys.length} price cache keys`);
    } else {
      console.log('   ℹ️  No price cache keys found');
    }
    console.log('');

    // 3. Clear AI chat cache
    console.log('💬 3. Clearing AI chat cache...');
    const chatKeys = await redis.keys('ai:chat:*');
    if (chatKeys.length > 0) {
      await redis.del(...chatKeys);
      console.log(`   ✅ Deleted ${chatKeys.length} chat cache keys`);
    } else {
      console.log('   ℹ️  No chat cache keys found');
    }
    console.log('');

    // 4. Clear general AI cache
    console.log('🤖 4. Clearing general AI cache...');
    const aiCacheKeys = await redis.keys('ai_cache:*');
    if (aiCacheKeys.length > 0) {
      await redis.del(...aiCacheKeys);
      console.log(`   ✅ Deleted ${aiCacheKeys.length} AI cache keys`);
    } else {
      console.log('   ℹ️  No AI cache keys found');
    }
    console.log('');

    // 5. Tổng kết
    const totalDeleted = autocompleteKeys.length + priceKeys.length + chatKeys.length + aiCacheKeys.length;
    console.log('📊 Summary:');
    console.log(`   Total cache keys deleted: ${totalDeleted}`);
    console.log('');

    console.log('✅ AI cache cleared successfully!');
    console.log('');
    console.log('📝 Note: Product cache (products:*) was NOT cleared.');
    console.log('   Product cache only stores product lists for display, not AI generation data.');

  } catch (error) {
    console.error('❌ Error clearing AI cache:', error);
  } finally {
    await redis.quit();
  }
}

clearAICache();
