/**
 * cleanup-duplicate-product-seo.ts
 *
 * Xoa ProductSEO trung cho cung 1 product, giu lai doc co nhieu field nhat.
 * Chay: npx tsx src/scripts/cleanup-duplicate-product-seo.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { ProductSEO } from '../models/ProductSEO.ts';

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set. Check .env file');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB: ' + MONGO_URI);

  // Group by productId and find duplicates
  const pipeline = [
    { $group: { _id: { productId: '$productId', tenantId: '$tenantId' }, count: { $sum: 1 }, docs: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ];

  const duplicates = await ProductSEO.aggregate(pipeline);
  console.log('Found ' + duplicates.length + ' products with duplicate SEO docs');

  let removed = 0;
  let totalDeleted = 0;

  for (const dup of duplicates) {
    const ids = dup.docs as mongoose.Types.ObjectId[];
    // Sort by updatedAt desc, keep the newest (most recently updated)
    const docs = await ProductSEO.find({ _id: { $in: ids } }).sort({ updatedAt: -1 }).lean();
    const keep = docs[0]._id;
    const deleteIds = docs.slice(1).map((d) => d._id);

    if (deleteIds.length > 0) {
      const result = await ProductSEO.deleteMany({ _id: { $in: deleteIds } });
      totalDeleted += result.deletedCount;
      removed++;
      console.log('  Cleaned product ' + dup._id.productId + ' - kept ' + keep + ', deleted ' + deleteIds.length);
    }
  }

  console.log('Done! Cleaned ' + removed + ' duplicate groups, deleted ' + totalDeleted + ' extra docs');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
