import { AIService } from './AIService.ts';

/**
 * EvalService — Hệ thống đánh giá chất lượng AI (Skill 6)
 * Triển khai mô hình LLM-as-a-Judge để đo lường độ chính xác và chống Hallucination.
 */
export class EvalService {
  /**
   * Đánh giá phản hồi của AI dựa trên ngữ cảnh (Faithfulness)
   * @param query Câu hỏi của người dùng
   * @param context Ngữ cảnh được cung cấp (RAG)
   * @param answer Câu trả lời của AI cần đánh giá
   */
  static async evaluateFaithfulness(query: string, context: string, answer: string): Promise<{ score: number; reason: string }> {
    const evalPrompt = `
      BẠN LÀ CHUYÊN GIA KIỂM ĐỊNH CHẤT LƯỢNG AI (QUALITY AUDITOR).
      Nhiệm vụ: Đánh giá xem câu trả lời của AI có dựa TRỰC TIẾP và CHÍNH XÁC trên kiến thức được cung cấp hay không.
      
      KIẾN THỨC CUNG CẤP:
      ${context}
      
      CÂU HỎI NGƯỜI DÙNG: ${query}
      
      CÂU TRẢ LỜI CỦA AI CẦN ĐÁNH GIÁ: ${answer}
      
      HÃY TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON:
      {
        "score": (Điểm từ 1-5, trong đó 5 là hoàn hảo),
        "reason": (Giải thích ngắn gọn lý do tại sao cho điểm đó)
      }
    `;

    try {
      // Sử dụng model mới nhất để làm Judge (Gemini 3.1 Flash-Lite)
      const resultText = await AIService.generateResponse(evalPrompt, 'system', 'gemini-3.1-flash-lite');
      
      // Parse JSON từ text (Xử lý trường hợp AI bọc trong ```json)
      const jsonStr = resultText.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('[EvalService Error]', error);
      return { score: 0, reason: 'Không thể thực hiện đánh giá.' };
    }
  }

  /**
   * Chạy bộ test suite tự động cho một tập dữ liệu "Gold Dataset"
   */
  static async runTestSuite(testCases: Array<{ q: string; c: string; a: string }>) {
    const results = [];
    for (const test of testCases) {
      const evaluation = await this.evaluateFaithfulness(test.q, test.c, test.a);
      results.push({ ...test, ...evaluation });
    }
    return results;
  }
}
