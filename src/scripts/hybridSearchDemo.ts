import * as dotenv from 'dotenv';
dotenv.config();

import { AIService } from '../services/AIService.ts';

/**
 * MOCK DATA: Giả lập kết quả từ 2 phương thức tìm kiếm
 */
const DOCUMENTS = [
  { id: 'doc1', title: 'Hướng dẫn bảo mật 2FA', content: 'Dùng TOTP (Speakeasy + QRCode). Secret Key phải được mã hóa trong DB.' },
  { id: 'doc2', title: 'Cấu trúc thư mục Backend', content: 'Dự án được chia thành các tầng controllers, services, repositories, models.' },
  { id: 'code1', title: 'AuthController.ts', content: 'export class AuthController { static async login(request: FastifyRequest, reply: FastifyReply) { ... } }' },
  { id: 'code2', title: 'TwoFactorService.ts', content: 'static verifyToken(token: string, secret: string) { return speakeasy.totp.verify({ secret, token }); }' },
];

/**
 * Giải thuật Reciprocal Rank Fusion (RRF)
 * Trộn 2 danh sách kết quả (Vector & Keyword) để tìm ra kết quả tối ưu nhất.
 */
function reciprocalRankFusion(vectorResults: string[], keywordResults: string[], k: number = 60) {
  const scores: Record<string, number> = {};

  // Rank từ Vector Search
  vectorResults.forEach((id, rank) => {
    scores[id] = (scores[id] || 0) + (1.0 / (k + rank + 1));
  });

  // Rank từ Keyword Search
  keywordResults.forEach((id, rank) => {
    scores[id] = (scores[id] || 0) + (1.0 / (k + rank + 1));
  });

  // Sắp xếp lại theo điểm số RRF
  return Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
}

async function runDemo() {
  console.log('🚀 Đang chạy Demo Hybrid Search (SaaS Skills 2026)...');
  const query = 'Làm sao để xác thực 2 lớp và lưu trữ secret?';

  console.log(`\n🔍 Query: "${query}"`);

  // 1. Giả lập Keyword Search (Tìm theo từ khóa "xác thực", "2 lớp", "secret")
  // Kết quả: code2 (verify), doc1 (hướng dẫn)
  const keywordResults = ['code2', 'doc1', 'doc2'];
  console.log('--- [Keyword Search Results] ---');
  keywordResults.forEach((id, i) => console.log(`${i + 1}. ${id}`));

  // 2. Giả lập Vector Search (Hiểu ngữ nghĩa của câu hỏi)
  // Kết quả: doc1 (giống nhất về ý nghĩa), code1 (liên quan login), code2
  const vectorResults = ['doc1', 'code2', 'code1'];
  console.log('\n--- [Vector Search (Semantic) Results] ---');
  vectorResults.forEach((id, i) => console.log(`${i + 1}. ${id}`));

  // 3. Thực hiện Fusion (Trộn kết quả)
  const finalRankedIds = reciprocalRankFusion(vectorResults, keywordResults);
  
  console.log('\n🏆 --- [FINAL HYBRID SEARCH RESULTS (RRF)] --- 🏆');
  finalRankedIds.forEach((id, i) => {
    const doc = DOCUMENTS.find(d => d.id === id);
    console.log(`${i + 1}. [${id}] ${doc?.title}`);
  });

  console.log('\n💡 Giải thích: Doc1 và Code2 đứng đầu vì chúng xuất hiện ở thứ hạng cao trong cả 2 phương thức tìm kiếm.');
}

runDemo().catch(console.error);
