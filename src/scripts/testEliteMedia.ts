import fs from 'fs/promises';
import path from 'path';
import { ImageService } from '../services/ImageService.ts';
import { AIService } from '../services/AIService.ts';
import * as dotenv from 'dotenv';

dotenv.config();

async function testEliteMedia() {
  const testImagePath = 'C:/Users/dandi/.gemini/antigravity/brain/6d384f5c-959e-412c-b3c0-728e27b0bdc2/saas_architecture_test_1778827653209.png';
  
  try {
    console.log('🚀 BẮT ĐẦU TEST ELITE MEDIA (VISION & OPTIMIZATION)...');
    
    // 1. Đọc ảnh gốc
    const originalBuffer = await fs.readFile(testImagePath);
    const originalSize = (originalBuffer.length / 1024).toFixed(2);
    console.log(`📸 Ảnh gốc: ${originalSize} KB`);

    // 2. Test Image Optimization (Sharp)
    console.log('⚙️ Đang tối ưu hóa ảnh (Sharp + WebP)...');
    const optimizedBuffer = await ImageService.optimizeForWeb(originalBuffer, 1000);
    const optimizedSize = (optimizedBuffer.length / 1024).toFixed(2);
    const ratio = (100 - (Number(optimizedSize) / Number(originalSize) * 100)).toFixed(1);
    
    console.log(`✅ Đã tối ưu: ${optimizedSize} KB (Giảm ${ratio}%)`);
    
    // Lưu ảnh đã tối ưu ra file để kiểm tra
    const outputPath = path.join(process.cwd(), 'uploads', 'optimized_test.webp');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, optimizedBuffer);
    console.log(`💾 Đã lưu ảnh tối ưu tại: ${outputPath}`);

    // 3. Test AI Vision (Gemini 3.1 Flash-Lite)
    console.log('👁️ AI đang phân tích nội dung hình ảnh...');
    const visionPrompt = "Hãy phân tích tấm ảnh sơ đồ kiến trúc này. Đây là hệ thống gì và có những thành phần chính nào?";
    const analysis = await AIService.analyzeImage(visionPrompt, originalBuffer);
    
    console.log('\n--- KẾT QUẢ PHÂN TÍCH AI ---');
    console.log(analysis);
    console.log('----------------------------\n');

    console.log('✨ HOÀN TẤT THỬ NGHIỆM ELITE MEDIA!');
  } catch (error) {
    console.error('❌ Lỗi trong quá trình thử nghiệm:', error);
  }
}

testEliteMedia().catch(console.error);
