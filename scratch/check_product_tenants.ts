/**
 * Script kiểm tra tenantId của các sản phẩm trong database
 * Chạy: npx tsx scratch/check_product_tenants.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.ts';

async function checkProductTenants() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/perfume-shop';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Lấy tất cả sản phẩm
    const allProducts = await Product.find({}).select('_id name tenantId createdAt').lean();
    
    console.log(`📦 Total products in database: ${allProducts.length}\n`);

    if (allProducts.length === 0) {
      console.log('ℹ️  No products found in database');
      return;
    }

    // Group by tenantId
    const byTenant: Record<string, any[]> = {};
    allProducts.forEach(product => {
      const tid = product.tenantId || 'null';
      if (!byTenant[tid]) byTenant[tid] = [];
      byTenant[tid].push(product);
    });

    console.log('📊 Products grouped by tenantId:\n');
    Object.keys(byTenant).forEach(tenantId => {
      const products = byTenant[tenantId];
      console.log(`🏢 TenantId: "${tenantId}"`);
      console.log(`   Count: ${products.length} products`);
      console.log(`   Products:`);
      products.forEach(p => {
        console.log(`     - ${p.name} (ID: ${p._id})`);
      });
      console.log('');
    });

    // Kiểm tra xem có sản phẩm nào với tenantId = 'default-tenant'
    const defaultTenantProducts = allProducts.filter(p => p.tenantId === 'default-tenant');
    console.log(`\n🎯 Products with tenantId = 'default-tenant': ${defaultTenantProducts.length}`);
    
    if (defaultTenantProducts.length === 0) {
      console.log('\n⚠️  WARNING: No products found with tenantId = "default-tenant"');
      console.log('   This is why the dashboard shows 0 products!');
      console.log('   The backend is querying for tenantId = "default-tenant"');
      console.log('   but products in DB have different tenantIds.\n');
      
      console.log('💡 Solutions:');
      console.log('   1. Update all products to use tenantId = "default-tenant"');
      console.log('   2. Fix auth middleware to set correct tenantId');
      console.log('   3. Update ProductController to use correct tenantId\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

checkProductTenants();
