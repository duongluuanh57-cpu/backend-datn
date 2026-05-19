/**
 * Script kiểm tra tags trong database
 * Chạy: npx tsx scratch/check_tags.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Tag } from '../src/models/Tag.ts';

async function checkTags() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/perfume-shop';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Lấy tất cả tags
    const allTags = await Tag.find({}).select('name slug status').lean();
    
    console.log(`📦 Total tags in database: ${allTags.length}\n`);

    if (allTags.length === 0) {
      console.log('ℹ️  No tags found in database');
      return;
    }

    console.log('📋 All tags:\n');
    allTags.forEach((tag: any) => {
      console.log(`   - ${tag.name} (slug: ${tag.slug}, status: ${tag.status})`);
    });
    console.log('');

    // Kiểm tra tag "Standard"
    const standardTag = allTags.find((t: any) => t.name === 'Standard');
    if (standardTag) {
      console.log('⚠️  Found "Standard" tag in database!');
      console.log(`   This is why AI selects it.`);
      console.log('');
      console.log('💡 Solutions:');
      console.log('   1. Delete "Standard" tag from database');
      console.log('   2. Change its status to "inactive"');
      console.log('   3. Rename it to something else');
    } else {
      console.log('✅ No "Standard" tag found in database');
      console.log('   AI should not be able to select it.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkTags();
