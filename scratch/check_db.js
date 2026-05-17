import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const ContentSchema = new mongoose.Schema({ tenantId: String, title: String, body: String });
const Content = mongoose.model('Content', ContentSchema, 'contents');

async function check() {
  try {
    const uri = process.env.MONGO_URI || '';
    console.log('🔗 Đang kết nối MongoDB:', uri.split('@')[1] || 'Unknown');
    await mongoose.connect(uri);
    
    const counts = await Content.aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📊 Thống kê dữ liệu theo tenantId:');
    console.table(counts);

    const total = await Content.countDocuments();
    console.log(`\n📚 Tổng số tài liệu: ${total}`);

    const sample = await Content.findOne().lean();
    console.log('\n📝 Mẫu một bản ghi dữ liệu:');
    console.log(sample);

    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  }
}

check();
