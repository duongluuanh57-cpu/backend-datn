/**
 * Script để fix tenantId của các sản phẩm về 'default-tenant'
 * Chạy: npx tsx scratch/fix_product_tenants.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.ts';
import { redis } from '../src/config/redis.ts';

async function fixProductTenants() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/perfume-shop';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Lấy tất cả sản phẩm không có tenantId = 'default-tenant'
    const productsToFix = await Product.find({
      $or: [
        { tenantId: { $ne: 'default-tenant' } },
        { tenantId: { $exists: false } },
        { tenantId: null }
      ]
    }).select('_id name tenantId').lean();

    console.log(`📦 Found ${productsToFix.length} products to fix\n`);

    if (productsToFix.length === 0) {
      console.log('✅ All products already have tenantId = "default-tenant"');
      return;
    }

    console.log('🔧 Products to be updated:');
    productsToFix.forEach(p => {
      console.log(`   - ${p.name} (Current tenantId: "${p.tenantId || 'null'}")`);
    });
    console.log('');

    // Confirm before updating
    console.log('⚠️  This will update all products to tenantId = "default-tenant"');
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Update all products
    const result = await Product.updateMany(
      {
        $or: [
          { tenantId: { $ne: 'default-tenant' } },
          { tenantId: { $exists: false } },
          { tenantId: null }
        ]
      },
      {
        $set: { tenantId: 'default-tenant' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} products to tenantId = "default-tenant"\n`);

    // Clear Redis cache
    console.log('🧹 Clearing Redis cache...');
    try {
      const keys = await redis.keys('products:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`   ✅ Cleared ${keys.length} cache keys`);
      } else {
        console.log('   ℹ️  No cache keys to clear');
      }
    } catch (redisErr) {
      console.warn('   ⚠️  Redis error (cache might not be cleared):', redisErr);
    }
    console.log('');

    // Verify
    const verifyCount = await Product.countDocuments({ tenantId: 'default-tenant' });
    console.log(`✅ Verification: ${verifyCount} products now have tenantId = "default-tenant"`);
    console.log('');
    console.log('🎉 Done! Refresh your dashboard to see the products.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    await redis.quit();
    console.log('✅ Disconnected from MongoDB and Redis');
  }
}

fixProductTenants();
