import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { redis } from "../config/redis.ts";
import crypto from "crypto";

// 1. Định nghĩa "Trạng thái" (State) của đồ thị
const AgentState = Annotation.Root({
  task: Annotation<string>(),
  research: Annotation<string>(),
  final_output: Annotation<string>(),
});

/**
 * AgentService — Quản lý luồng AI đa tác nhân bằng LangGraph (Exclusively Gemini 3.1 Flash Lite + Redis Cache)
 */
export class AgentService {
  private static _gemini: ChatGoogleGenerativeAI;
  private static _app: any;
  private static CACHE_TTL = 60 * 60 * 24; // 24 giờ

  // Model Gemini 3.1
  private static get gemini() {
    if (!this._gemini) {
      this._gemini = new ChatGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        model: "gemini-3.1-flash-lite",
      });
    }
    return this._gemini;
  }

  private static generateCacheKey(task: string): string {
    const hash = crypto.createHash('sha256').update(task).digest('hex');
    return `agent_workflow_cache:${hash}`;
  }

  /**
   * Khởi tạo và biên dịch đồ thị (Graph)
   */
  private static get app() {
    if (!this._app) {
      const workflow = new StateGraph(AgentState)
        .addNode("researcher", this.researcherNode.bind(this))
        .addNode("writer", this.writerNode.bind(this))
        .addNode("reviewer", this.reviewerNode.bind(this))
        .addEdge(START, "researcher")
        .addEdge("researcher", "writer")
        .addEdge("writer", "reviewer")
        .addEdge("reviewer", END);

      this._app = workflow.compile();
    }
    return this._app;
  }

  // Node 1: Researcher Agent (Gemini 3.1 Flash-Lite) - Tối giản
  private static async researcherNode(state: typeof AgentState.State) {
    console.log('--- [Step 1] Researcher (Gemini 3.1 Flash-Lite) is researching... ---');
    try {
      const response = await this.gemini.invoke([
        ["system", "Bạn là một người nghiên cứu thông thái nhưng thích kể chuyện bằng ngôn ngữ bình dân. Hãy tóm tắt ngắn gọn, dễ hiểu nhất có thể về chủ đề này."],
        ["user", state.task]
      ]);
      return { research: typeof response.content === 'string' ? response.content : JSON.stringify(response.content) };
    } catch (error) {
      console.error('Researcher Error:', error);
      throw error;
    }
  }

  // Node 2: Writer Agent (Gemini 3.1 Flash-Lite) - Bình dân hóa
  private static async writerNode(state: typeof AgentState.State) {
    console.log('--- [Step 2] Writer (Gemini 3.1 Flash-Lite) is writing... ---');
    try {
      const response = await this.gemini.invoke([
        ["system", "Bạn là một người kể chuyện tài ba. Hãy dựa trên nghiên cứu để viết một bài viết cực kỳ tối giản, dùng từ ngữ mà một người bình thường cũng hiểu được ngay. Tránh dùng từ chuyên môn khó hiểu."],
        ["user", `Nghiên cứu: ${state.research}`]
      ]);
      return { final_output: typeof response.content === 'string' ? response.content : JSON.stringify(response.content) };
    } catch (error) {
      console.error('Writer Error:', error);
      throw error;
    }
  }

  // Node 3: Reviewer Agent (Gemini 3.1) - Kiểm duyệt tính dễ hiểu
  private static async reviewerNode(state: typeof AgentState.State) {
    console.log('--- [Step 3] Reviewer (Gemini 3.1 Flash-Lite) is reviewing... ---');
    try {
      const response = await this.gemini.invoke([
        ["system", "Bạn là một biên tập viên quan tâm đến trải nghiệm người đọc phổ thông. Hãy kiểm tra bài viết sau, loại bỏ nốt những từ ngữ quá phức tạp, làm cho nó trở nên gần gũi, súc tích và dễ đọc nhất có thể. Đảm bảo văn phong tự nhiên."],
        ["user", `Bài viết cần duyệt: ${state.final_output}`]
      ]);
      return { final_output: typeof response.content === 'string' ? response.content : JSON.stringify(response.content) };
    } catch (error) {
      console.error('Reviewer Error:', error);
      throw error;
    }
  }

  /**
   * Chạy luồng xử lý đa tác nhân (Có Cache toàn bộ luồng)
   */
  static async runWorkflow(task: string) {
    const cacheKey = this.generateCacheKey(task);
    
    try {
      // 1. Kiểm tra cache workflow
      const cachedResult = await redis.get(cacheKey);
      if (cachedResult) {
        console.log('🚀 [Agent Cache] Hit! Trả về kết quả Workflow từ Redis.');
        return cachedResult;
      }

      // 2. Chạy workflow nếu không có cache
      const result = await this.app.invoke({ task });
      const finalOutput = result.final_output;

      // 3. Lưu vào cache (24h)
      await redis.set(cacheKey, finalOutput, 'EX', this.CACHE_TTL);
      
      return finalOutput;
    } catch (error) {
      console.error('[Agent Workflow Error]', error);
      throw error;
    }
  }
}
