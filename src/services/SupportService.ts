import { SearchService } from './SearchService.ts';
import { AgentService } from './AgentService.ts';
import { EvalService } from './EvalService.ts';

/**
 * SupportService — Điều phối Agent, Search và Eval cho tính năng Chat hỗ trợ khách hàng
 */
export class SupportService {
  /**
   * Xử lý câu hỏi của khách hàng về sản phẩm
   * Kết hợp RAG (Search), Multi-agent (LangGraph) và LLM-as-a-Judge (Eval)
   */
  static async handleChat(query: string, tenantId: string) {
    console.log(`🤖 [Support] Nhận câu hỏi: "${query}" (Tenant: ${tenantId})`);

    // 1. Tìm ngữ cảnh sản phẩm (Hybrid Search - RAG)
    const contextDocs = await SearchService.hybridSearch(query, tenantId, 3);
    const context = contextDocs.length > 0 
      ? contextDocs.map(doc => `[Tiêu đề: ${doc.title}]: ${doc.body}`).join('\n\n')
      : "Không tìm thấy thông tin cụ thể trong tài liệu sản phẩm.";

    // 2. Chạy luồng Agent đa tác nhân (LangGraph) để tổng hợp câu trả lời
    // LangGraph sẽ đi qua Researcher -> Writer -> Reviewer để tối ưu văn phong
    const agentTask = `
      NGỮ CẢNH SẢN PHẨM:
      ${context}

      CÂU HỎI NGƯỜI DÙNG:
      "${query}"

      YÊU CẦU:
      Hãy đóng vai một chuyên gia tư vấn cao cấp từ thương hiệu nước hoa L'essence. 
      Trả lời câu hỏi của khách hàng một cách sang trọng, tinh tế và đầy đủ kiến thức dựa trên ngữ cảnh được cung cấp.
      Nếu câu hỏi về công dụng, hãy giải thích rõ các tầng hương và lợi ích cảm xúc.
    `;
    
    const response = await AgentService.runWorkflow(agentTask);

    // 3. Đánh giá độ tin cậy bằng EvalService (LLM-as-a-Judge)
    // Chỉ đánh giá khi có ngữ cảnh (để tránh đánh giá sai các câu hỏi xã giao)
    let evaluation = { score: 5, reason: 'N/A' };
    if (contextDocs.length > 0) {
      evaluation = await EvalService.evaluateFaithfulness(query, context, response);
      console.log(`📊 [AI Eval] Score: ${evaluation.score}/5 - Lý do: ${evaluation.reason}`);
    }

    return {
      response,
      metadata: {
        evalScore: evaluation.score,
        evalReason: evaluation.reason,
        hasContext: contextDocs.length > 0,
        isReliable: evaluation.score >= 4
      }
    };
  }
}
