import 'dotenv/config';
import mongoose from 'mongoose';
import '../models/Brand.ts';
import '../models/Category.ts';
import { Product } from '../models/Product.ts';
import { ProductSEO } from '../models/ProductSEO.ts';
import { AIService } from '../services/AIService.ts';

async function migrateProductEmbeddings() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('📦 Connected to MongoDB');

  const products = await Product.find({})
    .populate(['brandId', 'categories'])
    .lean();

  console.log(`📊 Found ${products.length} products`);
  let migrated = 0;
  let skipped = 0;

  for (const product of products) {
    const existing = await ProductSEO.findOne({
      productId: product._id,
      tenantId: product.tenantId,
    }).lean();

    if (existing?.embedding?.length) {
      skipped++;
      continue;
    }

    const brandName = (product.brandId as any)?.name || '';
    const categoryNames = (product.categories as any[] || [])
      .map((c: any) => c?.name)
      .filter(Boolean)
      .join(' ');

    const textToEmbed = `${product.name} ${brandName} ${product.description || ''} ${categoryNames}`.trim();
    if (!textToEmbed) {
      console.warn(`⚠️  Skipping "${product.name}" — no text to embed`);
      skipped++;
      continue;
    }

    const embedding = await AIService.generateEmbedding(textToEmbed);

    await ProductSEO.findOneAndUpdate(
      { productId: product._id, tenantId: product.tenantId },
      {
        $set: { embedding },
        $setOnInsert: {
          tenantId: product.tenantId,
          productId: product._id,
          slug: product.name
            ? product.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
            : '',
          metaTitle: product.name || '',
          metaDescription: '',
          keywords: [],
          priceReport: '',
          sizeReport: '',
          discountReport: '',
        },
      },
      { upsert: true }
    );

    migrated++;
    console.log(`✅ [${migrated}] ${product.name}`);
  }

  console.log(`\n✨ Done: ${migrated} migrated, ${skipped} skipped`);
  process.exit(0);
}

migrateProductEmbeddings().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
