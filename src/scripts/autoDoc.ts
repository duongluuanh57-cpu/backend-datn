import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AIService } from '../services/AIService.ts';

dotenv.config();

const DOCS_DIR = path.resolve('..', 'Docs');
const SRC_DIR = path.resolve('src');

async function generateDocForFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(SRC_DIR, filePath);
  
  const prompt = `
    HÃY VIẾT TÀI LIỆU KỸ THUẬT CHO FILE SAU:
    File: ${relativePath}
    
    Nội dung code:
    ${content}
    
    Yêu cầu:
    1. Tóm tắt mục đích của file.
    2. Liệt kê các class/hàm chính và tham số.
    3. Định dạng bằng Markdown chuyên nghiệp.
  `;

  console.log(`📝 Đang tạo tài liệu cho: ${relativePath}...`);
  const doc = await AIService.generateResponse(prompt, 'system', 'gemini-3.1-flash-lite');
  
  const docPath = path.join(DOCS_DIR, 'auto-generated', `${relativePath.replace(/\//g, '_')}.md`);
  
  if (!fs.existsSync(path.dirname(docPath))) {
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
  }
  
  fs.writeFileSync(docPath, doc);
}

async function runAutoDoc() {
  console.log('🚀 Bắt đầu quy trình Auto-Documentation...');
  
  // Chỉ tài liệu hóa các folder quan trọng để tiết kiệm token
  const targets = ['services', 'controllers', 'middleware'];
  
  for (const dir of targets) {
    const dirPath = path.join(SRC_DIR, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.ts'));
      for (const file of files) {
        await generateDocForFile(path.join(dirPath, file));
      }
    }
  }
  
  console.log('✅ Hoàn tất Auto-Documentation! Kiểm tra trong thư mục Docs/auto-generated');
  process.exit(0);
}

runAutoDoc().catch(console.error);
