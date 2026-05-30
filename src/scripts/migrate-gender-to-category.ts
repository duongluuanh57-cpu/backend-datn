/**
 * Migration: Chuyển đổi gender (string) → categoryId (ObjectId ref)
 * 
 * Cách chạy: npx tsx src/scripts/migrate-gender-to-category.ts
 * 
 * Logic:
 * 1. Lấy danh sách gender unique từ products
 * 2. Tạo Category document cho mỗi gender (nếu chưa tồn tại)
 * 3. Cập nhật từng product: gender string → categoryId ObjectId
 * 4. Xoá field gender khỏi product documents
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/essence';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db!;
  const productsCollection = db.collection('products');
  const categoriesCollection = db.collection('categories');

  // 1. Lấy gender values unique
  const genderValues = await productsCollection.distinct('gender', { gender: { $exists: true, $ne: '' } });
  console.log(`Found ${genderValues.length} unique gender values:`, genderValues);

  // 2. Tạo Category cho mỗi gender (nếu chưa có)
  const categoryMap = new Map<string, string>(); // gender → categoryId
  for (const gender of genderValues) {
    const slug = gender
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let category = await categoriesCollection.findOne({ slug, tenantId: 'default-tenant' });
    if (!category) {
      const result = await categoriesCollection.insertOne({
        name: gender,
        slug,
        status: 'active',
        sortOrder: 0,
        tenantId: 'default-tenant',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      category = await categoriesCollection.findOne({ _id: result.insertedId });
      console.log(`  Created category: ${gender} → ${result.insertedId}`);
    } else {
      console.log(`  Found existing category: ${gender} → ${category._id}`);
    }
    categoryMap.set(gender, category!._id.toString());
  }

  // 3. Cập nhật products
  let updated = 0;
  for (const [gender, categoryId] of categoryMap) {
    const result = await productsCollection.updateMany(
      { gender, tenantId: 'default-tenant' },
      {
        $set: { categoryId: new mongoose.Types.ObjectId(categoryId) },
        $unset: { gender: '' }
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`  Updated ${result.modifiedCount} products: ${gender} → ${categoryId}`);
      updated += result.modifiedCount;
    }
  }

  // 4. Xoá field gender khỏi các product còn lại (nếu có giá trị rỗng)
  const remaining = await productsCollection.updateMany(
    { gender: { $exists: true } },
    { $unset: { gender: '' } }
  );
  if (remaining.modifiedCount > 0) {
    console.log(`Cleaned up ${remaining.modifiedCount} remaining products with gender field`);
  }

  console.log(`\nMigration complete! Updated ${updated} products total.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
