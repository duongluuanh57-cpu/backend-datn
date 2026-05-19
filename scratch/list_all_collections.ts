/**
 * Script để list tất cả collections trong database
 * Chạy: npx tsx scratch/list_all_collections.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';

async function listAllCollections() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/perfume-shop';
    console.log(`🔗 Connecting to: ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}\n`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get database name
    const dbName = mongoose.connection.db.databaseName;
    console.log(`📊 Database: ${dbName}\n`);

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📦 Total collections: ${collections.length}\n`);

    if (collections.length === 0) {
      console.log('ℹ️  No collections found in this database');
      return;
    }

    console.log('📋 Collections:\n');
    for (const collection of collections) {
      const collectionName = collection.name;
      const count = await mongoose.connection.db.collection(collectionName).countDocuments();
      console.log(`   ${collectionName.padEnd(30)} → ${count} documents`);
    }
    console.log('');

    // Check specifically for 'products' collection
    const productsCollection = collections.find(c => c.name === 'products');
    if (productsCollection) {
      console.log('✅ Found "products" collection');
      const productsCount = await mongoose.connection.db.collection('products').countDocuments();
      console.log(`   Total documents: ${productsCount}`);
      
      if (productsCount > 0) {
        console.log('\n📦 Sample products:');
        const sampleProducts = await mongoose.connection.db.collection('products')
          .find({})
          .limit(5)
          .project({ _id: 1, name: 1, tenantId: 1, createdAt: 1 })
          .toArray();
        
        sampleProducts.forEach((p: any) => {
          console.log(`   - ${p.name}`);
          console.log(`     ID: ${p._id}`);
          console.log(`     TenantId: ${p.tenantId || 'null'}`);
          console.log(`     Created: ${p.createdAt || 'N/A'}`);
          console.log('');
        });
      }
    } else {
      console.log('⚠️  "products" collection NOT found!');
      console.log('   This means no products have been created yet.');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('authentication')) {
      console.log('\n💡 Tip: Check your MONGO_URI credentials in .env file');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

listAllCollections();
