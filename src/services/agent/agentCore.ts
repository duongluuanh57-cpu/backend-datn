import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { redis } from "../../config/redis.ts";
import crypto from "crypto";
import { getGeminiClient } from './geminiClient.ts';
import { researcherNode, writerNode, reviewerNode } from './agentNodes.ts';

// 1. Định nghĩa "Trạng thái" (State) của đồ thị
const AgentState = Annotation.Root({
  task: Annotation<string>(),
  research: Annotation<string>(),
  final_output: Annotation<string>(),
});

/**
 * AgentCore — Khởi tạo LangGraph workflow + cache
 */
export class AgentCore {
  private static _app: any;
  private static CACHE_TTL = 60 * 60 * 24; // 24 giờ

  static generateCacheKey(task: string): string {
    const hash = crypto.createHash('sha256').update(task).digest('hex');
    return `agent_workflow_cache:${hash}`;
  }

  /**
   * Khởi tạo và biên dịch đồ thị (Graph)
   */
  static get app() {
    if (!this._app) {
      const workflow = new StateGraph(AgentState)
        .addNode("researcher", researcherNode)
        .addNode("writer", writerNode)
        .addNode("reviewer", reviewerNode)
        .addEdge(START, "researcher")
        .addEdge("researcher", "writer")
        .addEdge("writer", "reviewer")
        .addEdge("reviewer", END);

      this._app = workflow.compile();
    }
    return this._app;
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

  // Health check cho AgentService
  static async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', details: any }> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key') {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const client = getGeminiClient();
      const response = await client.invoke([
        ["system", "You are a helpful assistant."],
        ["user", "Hello"]
      ]);

      return {
        status: 'healthy',
        details: {
          apiKeyConfigured: true,
          model: "gemini-3.1-flash-lite",
          testResponse: typeof response.content === 'string'
            ? response.content.substring(0, 50) + '...'
            : 'Response received'
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          apiKeyConfigured: !!process.env.GEMINI_API_KEY,
          apiKeyLength: process.env.GEMINI_API_KEY?.length || 0
        }
      };
    }
  }
}