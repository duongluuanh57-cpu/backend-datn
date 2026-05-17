import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { AIService } from '../services/AIService.ts';

dotenv.config();

/**
 * AICodeReview — Agentic Code Auditor (Phase 3)
 * Tự động phân tích file thay đổi và đưa ra nhận xét về Bảo mật & Hiệu năng.
 */
async function runCodeReview(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error('File không tồn tại!');
    return;
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  
  const prompt = `
    BẠN LÀ CHUYÊN GIA AUDIT CODE (SENIOR SECURITY ARCHITECT).
    Hãy phân tích file code sau đây dựa trên các tiêu chuẩn "Elite SaaS 2026":
    
    FILE: ${filePath}
    CODE:
    ${code}
    
    YÊU CẦU PHÂN TÍCH:
    1. Bảo mật: Có lỗi SQL/NoSQL Injection, rò rỉ secret, hay thiếu validation không?
    2. Hiệu năng: Có N+1 query, thiếu Index, hay xử lý đồng bộ quá nặng không?
    3. Clean Code: Có tuân thủ Layered Architecture không?
    
    HÃY ĐƯA RA NHẬN XÉT CHI TIẾT VÀ ĐIỂM SỐ (1-10).
  `;

  console.log(`🔍 Đang Review Code: ${filePath}...`);
  const review = await AIService.generateResponse(prompt, 'system', 'gemini-3.1-flash-lite');
  
  console.log('\n--- KẾT QUẢ AI CODE REVIEW ---');
  console.log(review);
  console.log('------------------------------');
}

// Chạy thử với file AuthService.ts
const target = process.argv[2] || 'src/services/AuthService.ts';
runCodeReview(target).catch(console.error);
