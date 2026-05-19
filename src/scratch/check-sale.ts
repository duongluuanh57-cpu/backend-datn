import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkAllDiscountedProducts() {
  try {
    const mongoUri = process.env.MONGO_URI || '';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    if (!db) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }

    const products = await db.collection('products').find({
      $or: [
        { discountPercentage: { $gt: 0 } },
        { discountEndDate: { $ne: null } }
      ]
    }).toArray();
    
    console.log(`\n📦 FOUND ${products.length} PRODUCTS WITH DISCOUNT INFO IN DB:`);
    
    products.forEach((p, i) => {
      console.log(`\n--- Product ${i + 1} ---`);
      console.log(`ID: ${p._id}`);
      console.log(`Name: ${p.name}`);
      console.log(`Brand: ${p.brand}`);
      console.log(`Tag: ${p.tag}`);
      console.log(`Discount Percentage: ${p.discountPercentage}%`);
      console.log(`Discount End Date: ${p.discountEndDate} (Raw: ${JSON.stringify(p.discountEndDate)})`);
      console.log(`Tenant ID: ${p.tenantId}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during diagnostic:', err);
    process.exit(1);
  }
}

checkAllDiscountedProducts();
