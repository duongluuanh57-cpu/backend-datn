/**
 * backfill-product-seo.ts
 *
 * Create ProductSEO for products that don't have one yet.
 * Run: npx tsx src/scripts/backfill-product-seo.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { Product } from '../models/Product.ts';
import { ProductSEO } from '../models/ProductSEO.ts';

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
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set. Check .env file');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB: ' + MONGO_URI);

  const allProducts = await Product.find({}).lean();
  console.log('Total products: ' + allProducts.length);

  let created = 0;
  let updated = 0;

  for (const product of allProducts) {
    const existing = await ProductSEO.findOne({
      productId: product._id,
      tenantId: product.tenantId,
    }).lean();

    if (existing && existing.metaTitle) {
      updated++;
      continue;
    }

    await ProductSEO.findOneAndUpdate(
      { productId: product._id, tenantId: product.tenantId },
      {
        $set: {
          slug: product.name ? slugify(product.name) : '',
          metaTitle: product.name || '',
          metaDescription: existing?.metaDescription || '',
          keywords: existing?.keywords || [],
          priceReport: existing?.priceReport || '',
          sizeReport: existing?.sizeReport || '',
          discountReport: existing?.discountReport || '',
        },
        $setOnInsert: { tenantId: product.tenantId, productId: product._id }
      },
      { upsert: true }
    );

    if (existing) {
      console.log('  -> Updated SEO for: ' + product.name);
    } else {
      console.log('  -> Created SEO for: ' + product.name);
    }
    created++;
  }

  console.log('Done! Created/Updated: ' + created + ', Already complete: ' + updated + '/' + allProducts.length);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
