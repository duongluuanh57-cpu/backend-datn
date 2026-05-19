import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { redis } from '../config/redis.ts';
dotenv.config();

async function fixTagAndCache() {
  try {
    const mongoUri = process.env.MONGO_URI || '';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    if (!db) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }

    // Update Burberry Her Parfum tag to 'Sale'
    const result = await db.collection('products').updateOne(
      { _id: new mongoose.Types.ObjectId('6a0ab4eaaa277a9414e8103d') },
      { $set: { tag: 'Sale' } }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Successfully updated Burberry Her Parfum tag to "Sale" in MongoDB!');
    } else {
      console.warn('⚠️ Product tag was already set or ID mismatched');
    }

    // Clean Redis Cache
    console.log('🧹 Clearing Redis cache to force homepage reload...');
    try {
      const keys = ['products:new:tag:default-tenant', 'products:sale:tag:default-tenant'];
      for (const key of keys) {
        await redis.del(key);
        console.log(`Deleted key: ${key}`);
      }
      console.log('✅ Redis cache cleared successfully!');
    } catch (redisErr: any) {
      console.warn('Redis connection failed, cache might not be cleared:', redisErr.message);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error during fix:', err);
    process.exit(1);
  }
}

fixTagAndCache();
