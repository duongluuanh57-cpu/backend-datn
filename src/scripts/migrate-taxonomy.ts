/**
 * MIGRATION SCRIPT: product_taxonomies → taxonomies + taxonomy_terms + product_taxonomy_terms
 *
 * Chạy: npx tsx src/scripts/migrate-taxonomy.ts
 *
 * Quy trình:
 * 1. Đọc tất cả ProductTaxonomy (cũ) → tạo Taxonomy (cha) nếu chưa có
 * 2. Tạo TaxonomyTerm (con) từ mỗi ProductTaxonomy
 * 3. Đọc tất cả Product có scentGroups/concentrations/segments → tạo ProductTaxonomyTerm
 * 4. Báo cáo kết quả
 *
 * Script này IDEMPOTENT — chạy nhiều lần không bị duplicate nhờ upsert.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/database.ts';

// ── Import models ──────────────────────────────────────────────────────────
import { ProductTaxonomy } from '../models/ProductTaxonomy.ts';
import { Taxonomy } from '../models/Taxonomy.ts';
import { TaxonomyTerm } from '../models/TaxonomyTerm.ts';
import { ProductTaxonomyTerm } from '../models/ProductTaxonomyTerm.ts';

// Đọc trực tiếp từ collection products (không dùng model mới đã xóa fields)
const ProductRaw = mongoose.model(
  'ProductRaw',
  new mongoose.Schema({}, { strict: false, collection: 'products' })
);

// ── Mapping type cũ → slug mới ─────────────────────────────────────────────
const TYPE_TO_SLUG: Record<string, string> = {
  scent_group: 'scent_group',
  concentration: 'concentration',
  segment: 'segment',
};

const TYPE_TO_NAME: Record<string, string> = {
  scent_group: 'Nhóm mùi hương',
  concentration: 'Nồng độ',
  segment: 'Phân khúc',
};

// ── Counters ───────────────────────────────────────────────────────────────
let taxonomiesCreated = 0;
let termsCreated = 0;
let linksCreated = 0;
let productsProcessed = 0;
let errors = 0;

async function run() {
  await connectDB();
  console.log('\n🚀 Bắt đầu migration taxonomy...\n');

  // ── BƯỚC 1: Tạo Taxonomy (cha) cho mỗi type ───────────────────────────────
  console.log('📂 Bước 1: Tạo Taxonomy (cha)...');

  // Lấy tất cả tenantId đang có trong product_taxonomies
  const tenantIds: string[] = await ProductTaxonomy.distinct('tenantId');
  console.log(`   Tìm thấy ${tenantIds.length} tenant(s): ${tenantIds.join(', ')}`);

  const taxonomyMap = new Map<string, mongoose.Types.ObjectId>();
  // key: `${tenantId}:${slug}` → taxonomyId

  for (const tenantId of tenantIds) {
    for (const [slug, name] of Object.entries(TYPE_TO_NAME)) {
      const existing = await Taxonomy.findOne({ tenantId, slug });
      if (existing) {
        taxonomyMap.set(`${tenantId}:${slug}`, existing._id as mongoose.Types.ObjectId);
        console.log(`   ✅ Taxonomy "${name}" (${tenantId}) đã tồn tại`);
      } else {
        const created = await Taxonomy.create({ tenantId, slug, name, status: 'active', sortOrder: 0 });
        taxonomyMap.set(`${tenantId}:${slug}`, created._id as mongoose.Types.ObjectId);
        taxonomiesCreated++;
        console.log(`   ➕ Tạo Taxonomy "${name}" (${tenantId})`);
      }
    }
  }

  // ── BƯỚC 2: Tạo TaxonomyTerm (con) từ ProductTaxonomy cũ ─────────────────
  console.log('\n📝 Bước 2: Tạo TaxonomyTerm (con)...');

  const allOldTaxonomies = await ProductTaxonomy.find({}).lean();
  console.log(`   Tìm thấy ${allOldTaxonomies.length} taxonomy terms cũ`);

  // Map: oldId → newTermId (dùng ở bước 3)
  const oldIdToTermId = new Map<string, mongoose.Types.ObjectId>();

  for (const old of allOldTaxonomies) {
    const slug = TYPE_TO_SLUG[old.type];
    if (!slug) {
      console.warn(`   ⚠️ Bỏ qua type không hợp lệ: ${old.type}`);
      errors++;
      continue;
    }

    const taxonomyId = taxonomyMap.get(`${old.tenantId}:${slug}`);
    if (!taxonomyId) {
      console.warn(`   ⚠️ Không tìm thấy taxonomy cho ${old.tenantId}:${slug}`);
      errors++;
      continue;
    }

    try {
      const term = await TaxonomyTerm.findOneAndUpdate(
        { tenantId: old.tenantId, taxonomyId, slug: old.slug },
        {
          $setOnInsert: {
            tenantId: old.tenantId,
            taxonomyId,
            name: old.name,
            slug: old.slug,
            description: old.description || '',
            sortOrder: old.sortOrder || 0,
            status: old.status || 'active',
          },
        },
        { upsert: true, new: true }
      );

      oldIdToTermId.set(old._id.toString(), term._id as mongoose.Types.ObjectId);
      termsCreated++;
      console.log(`   ➕ Term: "${old.name}" (${old.type}) → tenant: ${old.tenantId}`);
    } catch (err: any) {
      console.error(`   ❌ Lỗi tạo term "${old.name}": ${err.message}`);
      errors++;
    }
  }

  // ── BƯỚC 3: Tạo ProductTaxonomyTerm từ mảng cũ trong products ─────────────
  console.log('\n🔗 Bước 3: Tạo liên kết Product ↔ TaxonomyTerm...');

  // Lấy tất cả products có ít nhất 1 trong 3 mảng cũ
  const products = await ProductRaw.find({
    $or: [
      { scentGroups: { $exists: true, $not: { $size: 0 } } },
      { concentrations: { $exists: true, $not: { $size: 0 } } },
      { segments: { $exists: true, $not: { $size: 0 } } },
    ],
  }).lean();

  console.log(`   Tìm thấy ${products.length} sản phẩm cần migrate`);

  for (const product of products) {
    const p = product as any;
    const productId = p._id as mongoose.Types.ObjectId;
    const tenantId = p.tenantId as string;

    const fieldMap: Record<string, string> = {
      scentGroups: 'scent_group',
      concentrations: 'concentration',
      segments: 'segment',
    };

    for (const [field, slug] of Object.entries(fieldMap)) {
      const oldIds: mongoose.Types.ObjectId[] = p[field] || [];
      if (oldIds.length === 0) continue;

      const taxonomyId = taxonomyMap.get(`${tenantId}:${slug}`);
      if (!taxonomyId) continue;

      for (const oldId of oldIds) {
        const termId = oldIdToTermId.get(oldId.toString());
        if (!termId) {
          console.warn(`   ⚠️ Không tìm thấy term mới cho oldId ${oldId} (product: ${productId})`);
          errors++;
          continue;
        }

        try {
          await ProductTaxonomyTerm.findOneAndUpdate(
            { tenantId, productId, termId },
            { $setOnInsert: { tenantId, productId, termId, taxonomyId } },
            { upsert: true }
          );
          linksCreated++;
        } catch (err: any) {
          if (err.code !== 11000) {
            console.error(`   ❌ Lỗi tạo link product ${productId} ↔ term ${termId}: ${err.message}`);
            errors++;
          }
        }
      }
    }

    productsProcessed++;
    if (productsProcessed % 50 === 0) {
      console.log(`   ... đã xử lý ${productsProcessed}/${products.length} sản phẩm`);
    }
  }

  // ── KẾT QUẢ ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log('✅ MIGRATION HOÀN TẤT');
  console.log('═'.repeat(50));
  console.log(`   Taxonomies (cha) tạo mới : ${taxonomiesCreated}`);
  console.log(`   TaxonomyTerms (con) tạo  : ${termsCreated}`);
  console.log(`   Liên kết Product↔Term    : ${linksCreated}`);
  console.log(`   Sản phẩm đã xử lý        : ${productsProcessed}`);
  console.log(`   Lỗi                      : ${errors}`);
  console.log('═'.repeat(50) + '\n');

  await mongoose.disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('💥 Migration thất bại:', err);
  process.exit(1);
});
