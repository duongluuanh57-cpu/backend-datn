/**
 * Migration Script: Chuyển taxonomy từ string sang ObjectId references
 * 
 * Script này sẽ:
 * 1. Lấy tất cả products có scentGroup, concentration, segment dạng string
 * 2. Tìm hoặc tạo ProductTaxonomy tương ứng
 * 3. Cập nhật Product với ObjectId references
 */

import mongoose from 'mongoose';
import { Product } from '../models/Product.ts';
import { ProductTaxonomy } from '../models/ProductTaxonomy.ts';
import dotenv from 'dotenv';

dotenv.config();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findOrCreateTaxonomy(
  name: string,
  type: 'segment' | 'scent_group' | 'concentration',
  tenantId: string
): Promise<mongoose.Types.ObjectId> {
  const slug = slugify(name);
  
  let taxonomy = await ProductTaxonomy.findOne({ tenantId, type, slug });
  
  if (!taxonomy) {
    taxonomy = await ProductTaxonomy.create({
      tenantId,
      type,
      name,
      slug,
      status: 'active'
    });
    console.log(`  ✅ Created taxonomy: ${type} - ${name}`);
  }
  
  return taxonomy._id;
}

async function migrateTaxonomies() {
  try {
    console.log('🚀 Bắt đầu migration Product Taxonomies...\n');

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB\n');

    // Lấy tất cả products
    const products = await Product.find({}).lean();
    console.log(`📊 Tìm thấy ${products.length} sản phẩm\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        const tenantId = product.tenantId;
        const updates: any = {};
        let hasUpdates = false;

        // Migrate scentGroup (string -> array of ObjectIds)
        if ((product as any).scentGroup && typeof (product as any).scentGroup === 'string') {
          const scentGroupNames = (product as any).scentGroup.split(',').map((s: string) => s.trim()).filter(Boolean);
          const scentGroupIds = [];
          
          for (const name of scentGroupNames) {
            const id = await findOrCreateTaxonomy(name, 'scent_group', tenantId);
            scentGroupIds.push(id);
          }
          
          updates.scentGroups = scentGroupIds;
          updates.$unset = { ...(updates.$unset || {}), scentGroup: '' };
          hasUpdates = true;
        }

        // Migrate concentration (string -> array of ObjectIds)
        if ((product as any).concentration && typeof (product as any).concentration === 'string') {
          const concentrationNames = (product as any).concentration.split(',').map((s: string) => s.trim()).filter(Boolean);
          const concentrationIds = [];
          
          for (const name of concentrationNames) {
            const id = await findOrCreateTaxonomy(name, 'concentration', tenantId);
            concentrationIds.push(id);
          }
          
          updates.concentrations = concentrationIds;
          updates.$unset = { ...(updates.$unset || {}), concentration: '' };
          hasUpdates = true;
        }

        // Migrate segment (string -> array of ObjectIds)
        if ((product as any).segment && typeof (product as any).segment === 'string') {
          const segmentNames = (product as any).segment.split(',').map((s: string) => s.trim()).filter(Boolean);
          const segmentIds = [];
          
          for (const name of segmentNames) {
            const id = await findOrCreateTaxonomy(name, 'segment', tenantId);
            segmentIds.push(id);
          }
          
          updates.segments = segmentIds;
          updates.$unset = { ...(updates.$unset || {}), segment: '' };
          hasUpdates = true;
        }

        if (hasUpdates) {
          await Product.updateOne({ _id: product._id }, updates);
          successCount++;
          console.log(`✅ Migrated: ${product.name}`);
        } else {
          skipCount++;
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating product ${product.name}:`, error);
      }
    }

    // Tổng kết
    console.log('\n' + '='.repeat(60));
    console.log('📈 KẾT QUẢ MIGRATION:');
    console.log('='.repeat(60));
    console.log(`✅ Thành công: ${successCount}`);
    console.log(`⏭️  Skip: ${skipCount}`);
    console.log(`❌ Lỗi: ${errorCount}`);
    console.log(`📊 Tổng cộng: ${products.length}`);
    console.log('='.repeat(60) + '\n');

    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');
    console.log('🎉 Migration hoàn tất!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateTaxonomies();
