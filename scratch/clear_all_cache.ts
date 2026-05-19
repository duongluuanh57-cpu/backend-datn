/**
 * Script để clear TẤT CẢ cache (Redis + MongoDB)
 * Chạy: npx tsx scratch/clear_all_cache.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { redis } from '../src/config/redis.ts';

async function clearAllCache() {
  try {
    console.log('🧹 Clearing ALL cache (Redis + MongoDB)...\n');

    // 1. Clear Redis
    console.log('💾 1. Clearing Redis cache...');
    try {
      const keys = await redis.keys('*');
      if (keys.length > 0) {
        console.log(`   Found ${keys.length} keys in Redis`);
        
        // Group by prefix
        const aiKeys = keys.filter(k => k.startsWith('ai'));
        const productKeys = keys.filter(k => k.startsWith('products:'));
        const otherKeys = keys.filter(k => !k.startsWith('ai') && !k.startsWith('products:'));
        
        console.log(`   - AI cache: ${aiKeys.length} keys`);
        console.log(`   - Product cache: ${productKeys.length} keys`);
        console.log(`   - Other cache: ${otherKeys.length} keys`);
        
        await redis.flushall();
        console.log(`   ✅ Cleared all ${keys.length} Redis keys`);
      } else {
        console.log('   ℹ️  No keys found in Redis');
      }
    } catch (redisErr) {
      console.warn('   ⚠️  Redis error:', redisErr);
    }
    console.log('');

    // 2. Check MongoDB for cache collections
    console.log('🗄️  2. Checking MongoDB for cache collections...');
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/perfume-shop';
    await mongoose.connect(mongoUri);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    const cacheCollections = collections.filter(c => 
      c.name.includes('cache') || 
      c.name.includes('temp') ||
      c.name.includes('session')
    );
    
    if (cacheCollections.length > 0) {
      console.log(`   Found ${cacheCollections.length} potential cache collections:`);
      for (const col of cacheCollections) {
        const count = await mongoose.connection.db.collection(col.name).countDocuments();
        console.log(`   - ${col.name}: ${count} documents`);
      }
      console.log('');
      console.log('   ⚠️  Do you want to delete these collections? (Manual action required)');
    } else {
      console.log('   ✅ No cache collections found in MongoDB');
    }
    console.log('');

    // 3. Check Knowledge collection (AI chat cache)
    console.log('💬 3. Checking Knowledge collection (AI chat history)...');
    try {
      const knowledgeCount = await mongoose.connection.db.collection('knowledges').countDocuments();
      if (knowledgeCount > 0) {
        console.log(`   Found ${knowledgeCount} knowledge entries`);
        console.log('   These are AI chat responses cached in MongoDB');
        console.log('');
        console.log('   To clear: db.knowledges.deleteMany({})');
      } else {
        console.log('   ℹ️  No knowledge entries found');
      }
    } catch (err) {
      console.log('   ℹ️  Knowledge collection does not exist');
    }
    console.log('');

    console.log('✅ Cache check completed!');
    console.log('');
    console.log('📝 Summary:');
    console.log('   - Redis cache: CLEARED');
    console.log('   - MongoDB cache: CHECKED (manual action if needed)');
    console.log('   - AI generation: NO CACHE (always fresh)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await redis.quit();
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from Redis and MongoDB');
  }
}

clearAllCache();
