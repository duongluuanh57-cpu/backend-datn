import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkProducts() {
  try {
    await mongoose.connect(process.env.MONGO_URI || '');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    if (!db) return;

    const products = await db.collection('products').find({}).toArray();
    console.log('\n📦 DANH SÁCH SẢN PHẨM TRONG KHO:');
    if (products.length === 0) {
      console.log('❌ KHO TRỐNG KHÔNG CÓ SẢN PHẨM NÀO!');
    } else {
      products.forEach((p, i) => {
        console.log(`${i + 1}. [${p.brand}] ${p.name} - Tenant: ${p.tenantId}`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkProducts();
