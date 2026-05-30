import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkProducts() {
  try {
    await mongoose.connect(process.env.MONGO_URI || '');
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) return;

    const products = await db.collection('products').find({}).toArray();
    console.log(`📊 Total products: ${products.length}\n`);

    let hasCategories = 0;
    let emptyCategories = 0;
    let missingCategories = 0;
    let oldCategory = 0;
    let oldCategoryId = 0;
    const samplesEmpty: string[] = [];
    const samplesOld: string[] = [];

    for (const p of products) {
      const cats = p.categories;
      const name = p.name || '(no name)';
      const id = p._id.toString();

      if (Array.isArray(cats) && cats.length > 0) {
        hasCategories++;
      } else if (Array.isArray(cats) && cats.length === 0) {
        emptyCategories++;
        if (samplesEmpty.length < 5) samplesEmpty.push(`${name} (${id})`);
      } else {
        missingCategories++;
        if (samplesEmpty.length < 5 && !samplesEmpty.some(s => s.includes(name))) {
          samplesEmpty.push(`${name} (${id})`);
        }
      }

      if (p.category) {
        oldCategory++;
        if (samplesOld.length < 3) samplesOld.push(`${name} → category: ${p.category}`);
      }
      if (p.categoryId) {
        oldCategoryId++;
        if (samplesOld.length < 3 && !samplesOld.some(s => s.includes(name))) {
          samplesOld.push(`${name} → categoryId: ${p.categoryId}`);
        }
      }
    }

    console.log('📋 CATEGORIES FIELD STATUS:');
    console.log(`   ✅ Has categories:   ${hasCategories}`);
    console.log(`   ⚠️  Empty array:      ${emptyCategories}`);
    console.log(`   ❌ Missing field:    ${missingCategories}`);
    console.log('');
    console.log('📋 OLD SINGULAR FIELDS:');
    console.log(`   📌 Has category:     ${oldCategory}`);
    console.log(`   📌 Has categoryId:   ${oldCategoryId}`);
    console.log('');

    if (samplesEmpty.length > 0) {
      console.log('🔍 Sample products WITHOUT categories:');
      samplesEmpty.forEach(s => console.log(`   • ${s}`));
      console.log('');
    }

    if (samplesOld.length > 0) {
      console.log('🔍 Sample products WITH old fields:');
      samplesOld.forEach(s => console.log(`   • ${s}`));
      console.log('');
    }

    // Check Taxonomy slugs
    const taxonomies = await db.collection('taxonomies').find({}).project({ slug: 1, _id: 1 }).toArray();
    console.log('📋 Taxonomy slugs:', taxonomies.map(t => t.slug).join(', '));
    const catTaxonomy = taxonomies.find(t => t.slug === 'category');

    // Check junction table for any records that might be for categories
    const junctionCount = await db.collection('product_taxonomy_terms').countDocuments();
    console.log(`📋 Total junction records: ${junctionCount}`);

    if (catTaxonomy) {
      const catLinks = await db.collection('product_taxonomy_terms')
        .find({ taxonomyId: catTaxonomy._id })
        .limit(5)
        .toArray();
      console.log(`   Links with taxonomy='category': ${catLinks.length}`);
      catLinks.forEach(l => console.log(`   • productId: ${l.productId?.toString()}, termId: ${l.termId?.toString()}`));
    } else {
      console.log('   ⚠️ No Taxonomy with slug "category" exists — junction table cannot have category links');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkProducts();
