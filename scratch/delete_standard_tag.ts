/**
 * Script xóa tag "Standard" khỏi database
 * Chạy: npx tsx scratch/delete_standard_tag.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Tag } from '../src/models/Tag.ts';

async function deleteStandardTag() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/perfume-shop';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Tìm tag "Standard"
    const standardTags = await Tag.find({ 
      $or: [
        { name: 'Standard' },
        { slug: 'Standard' },
        { name: /standard/i },
        { slug: /standard/i }
      ]
    }).lean();

    if (standardTags.length === 0) {
      console.log('ℹ️  No "Standard" tag found in database');
      console.log('   AI might be using fallback value.');
      return;
    }

    console.log(`📦 Found ${standardTags.length} "Standard" tag(s):\n`);
    standardTags.forEach((tag: any) => {
      console.log(`   - ${tag.name} (slug: ${tag.slug}, status: ${tag.status}, tenantId: ${tag.tenantId})`);
    });
    console.log('');

    console.log('⚠️  This will DELETE all "Standard" tags from database');
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Xóa tất cả tags "Standard"
    const result = await Tag.deleteMany({
      $or: [
        { name: 'Standard' },
        { slug: 'Standard' },
        { name: /standard/i },
        { slug: /standard/i }
      ]
    });

    console.log(`✅ Deleted ${result.deletedCount} "Standard" tag(s)`);
    console.log('');
    console.log('🎉 Done! AI will no longer be able to select "Standard" tag.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

deleteStandardTag();
