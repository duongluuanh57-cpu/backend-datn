/**
 * Script tạo tag "Standard" trong database
 * Chạy: npx tsx scratch/create_standard_tag.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Tag } from '../src/models/Tag.ts';

async function createStandardTag() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/perfume-shop';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const tenantId = 'default-tenant';

    // Kiểm tra xem tag "Standard" đã tồn tại chưa
    const existingTag = await Tag.findOne({ 
      tenantId,
      $or: [
        { name: 'Standard' },
        { slug: 'standard' }
      ]
    });

    if (existingTag) {
      console.log('⚠️  Tag "Standard" already exists!');
      console.log(`   Name: ${existingTag.name}`);
      console.log(`   Slug: ${existingTag.slug}`);
      console.log(`   Status: ${existingTag.status}`);
      console.log(`   TenantId: ${existingTag.tenantId}`);
      console.log('');
      
      // Update status to active nếu đang inactive
      if (existingTag.status !== 'active') {
        existingTag.status = 'active';
        await existingTag.save();
        console.log('✅ Updated status to "active"');
      } else {
        console.log('ℹ️  Tag is already active. No changes needed.');
      }
      return;
    }

    // Tạo tag mới
    console.log('📝 Creating new "Standard" tag...\n');
    
    const newTag = new Tag({
      name: 'Standard',
      slug: 'standard',
      status: 'active',
      tenantId
    });

    await newTag.save();

    console.log('✅ Successfully created "Standard" tag!');
    console.log(`   Name: ${newTag.name}`);
    console.log(`   Slug: ${newTag.slug}`);
    console.log(`   Status: ${newTag.status}`);
    console.log(`   TenantId: ${newTag.tenantId}`);
    console.log(`   ID: ${newTag._id}`);
    console.log('');
    console.log('🎉 Done! AI can now select "Standard" tag.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

createStandardTag();
