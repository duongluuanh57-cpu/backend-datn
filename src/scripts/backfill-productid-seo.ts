/**
 * backfill-productid-seo.ts
 *
 * Đồng bộ DB: backfill productId vào product_seo dựa vào Product.seoId,
 * dọn duplicate, xoá seoId khỏi Product.
 *
 * Chạy: npx tsx src/scripts/backfill-productid-seo.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) { console.error('MONGO_URI is not set'); process.exit(1); }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const db = mongoose.connection.db!;
  const productsCol = db.collection('products');
  const seoCol = db.collection('product_seo');

  // === Step 1: Backfill productId từ seoId ===
  console.log('--- Step 1: Backfill productId from seoId ---');
  const productsWithSeoId = await productsCol.find({ seoId: { $exists: true } }).toArray();
  console.log(`Products with seoId: ${productsWithSeoId.length}`);

  let backfilled = 0;
  for (const product of productsWithSeoId) {
    if (!product.seoId) continue;

    const result = await seoCol.updateOne(
      { _id: product.seoId },
      { $set: { productId: product._id, tenantId: product.tenantId } }
    );

    if (result.matchedCount === 0) {
      console.log(`  ⚠️  Product "${product.name}" seoId ${product.seoId} not found in product_seo (stale)`);
    } else {
      console.log(`  ✅ Product "${product.name}" → productId set`);
      backfilled++;
    }

    await productsCol.updateOne(
      { _id: product._id },
      { $unset: { seoId: '' } }
    );
  }
  console.log(`Backfilled: ${backfilled}, stale seoId removed: ${productsWithSeoId.length - backfilled}\n`);

  // === Step 2: Xoá duplicate SEO docs (giữ lại doc có nhiều field fill nhất) ===
  console.log('--- Step 2: Remove duplicate SEO docs ---');
  const dupPipeline = [
    { $group: { _id: { productId: '$productId', tenantId: '$tenantId' }, count: { $sum: 1 }, docs: { $push: { _id: '$_id', metaTitle: '$metaTitle', metaDescription: '$metaDescription', keywords: '$keywords' } } } },
    { $match: { count: { $gt: 1 } } },
  ];
  const duplicates = await seoCol.aggregate(dupPipeline).toArray();
  console.log(`Found ${duplicates.length} product(s) with duplicate SEO`);

  let deleted = 0;
  for (const dup of duplicates) {
    const docs = dup.docs as any[];
    // Sort: doc có nhiều field fill nhất (metaTitle, metaDescription, keywords) giữ lại
    docs.sort((a, b) => {
      const scoreA = [a.metaTitle, a.metaDescription, a.keywords?.length ? 'x' : ''].filter(Boolean).length;
      const scoreB = [b.metaTitle, b.metaDescription, b.keywords?.length ? 'x' : ''].filter(Boolean).length;
      return scoreB - scoreA;
    });
    const keep = docs[0]._id;
    const deleteIds = docs.slice(1).map(d => d._id);

    if (deleteIds.length > 0) {
      const r = await seoCol.deleteMany({ _id: { $in: deleteIds } });
      deleted += r.deletedCount;
      console.log(`  Cleaned productId ${dup._id.productId}: kept ${keep}, deleted ${r.deletedCount}`);
    }
  }
  console.log(`Total duplicates deleted: ${deleted}\n`);

  // === Step 3: Tạo SEO cho products chưa có ===
  console.log('--- Step 3: Create missing SEO docs ---');
  const allSeo = await seoCol.find({}).toArray();
  const allProducts = await productsCol.find({}).toArray();

  // Build map: productId -> existing SEO
  const seoMap = new Map<string, any>();
  for (const s of allSeo) {
    if (s.productId) seoMap.set(s.productId.toString(), s);
  }

  let created = 0;
  for (const product of allProducts) {
    const pid = product._id.toString();
    if (seoMap.has(pid)) continue;

    await seoCol.insertOne({
      tenantId: product.tenantId,
      productId: product._id,
      metaTitle: product.name || '',
      metaDescription: '',
      keywords: [],
      slug: product.name ? slugify(product.name) : '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      canonicalUrl: '',
      priceReport: '',
      sizeReport: '',
      discountReport: '',
      embedding: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`  Created SEO for product: "${product.name}"`);
    created++;
  }
  console.log(`Created: ${created}\n`);

  // === Step 4: Tạo unique index ===
  console.log('--- Step 4: Create unique index ---');
  // Xoá index cũ nếu có
  try {
    await seoCol.dropIndex('productId_1_tenantId_1');
    console.log('Dropped old index productId_1_tenantId_1');
  } catch { /* not found */ }
  try {
    await seoCol.dropIndex('productId_1');
    console.log('Dropped old index productId_1');
  } catch { /* not found */ }

  await seoCol.createIndex({ productId: 1, tenantId: 1 }, { unique: true });
  console.log('Created unique index productId_1_tenantId_1\n');

  // === Step 5: Verify ===
  console.log('--- Verify ---');
  const finalSeoCount = await seoCol.countDocuments({ productId: { $exists: true } });
  const finalProductsCount = await productsCol.countDocuments({});
  const remainingSeoId = await productsCol.countDocuments({ seoId: { $exists: true } });
  console.log(`SEO docs with productId: ${finalSeoCount}`);
  console.log(`Total products: ${finalProductsCount}`);
  console.log(`Products still with seoId: ${remainingSeoId} (must be 0)`);

  if (finalSeoCount === finalProductsCount && remainingSeoId === 0) {
    console.log('\n✅ All good!');
  } else {
    console.log('\n⚠️  Mismatch - check manual');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
