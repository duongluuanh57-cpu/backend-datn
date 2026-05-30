/**
 * AIService — Barrel file (re-export từ các module nhỏ hơn)
 *
 * File này được giữ lại để backward compatibility.
 * Code thực tế đã được tách vào thư mục `services/ai/`:
 *   - aiClient.ts         → getGeminiClient, healthCheck, PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL, CACHE_TTL
 *   - aiVisionService.ts  → identifyProduct
 *   - aiStreamService.ts  → createChatStream, createBatchChatStream
 *   - aiResponseService.ts → generateResponse
 *   - aiEmbedding.ts       → generateEmbedding
 */
export { getGeminiClient, healthCheck, PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL, CACHE_TTL } from './ai/aiClient.ts';
export { identifyProduct } from './ai/aiVisionService.ts';
export { createChatStream, createBatchChatStream } from './ai/aiStreamService.ts';
export { generateResponse } from './ai/aiResponseService.ts';
export { generateEmbedding } from './ai/aiEmbedding.ts';

// Re-import cho backward-compatible class
import { healthCheck as _healthCheck } from './ai/aiClient.ts';
import { identifyProduct as _identifyProduct } from './ai/aiVisionService.ts';
import { createChatStream as _createChatStream, createBatchChatStream as _createBatchChatStream } from './ai/aiStreamService.ts';
import { generateResponse as _generateResponse } from './ai/aiResponseService.ts';
import { generateEmbedding as _generateEmbedding } from './ai/aiEmbedding.ts';

// ============================================================
// Backward-compatible AIService class
// Giữ nguyên tên class + method signatures để không break imports
// ============================================================
export class AIService {
  private static _genAI: any;
  private static CACHE_TTL = 60 * 60 * 24;
  private static PRIMARY_MODEL = 'gemini-3.1-flash-lite';
  private static FALLBACK_MODEL = 'gemini-2.0-flash-lite';
  private static SECONDARY_FALLBACK_MODEL = 'gemini-1.5-flash-lite';

  static async healthCheck() {
    return _healthCheck();
  }

  static async identifyProduct(image: string, prompt: string): Promise<string> {
    return _identifyProduct(image, prompt);
  }

  static async createChatStream(messages: any[], systemPrompt?: string, image?: string) {
    return _createChatStream(messages, systemPrompt, image);
  }

  static async createBatchChatStream(
    items: Array<{
      shortId: string;
      question: string;
      context: string;
      storeOverview: string;
      adaptiveDirective: string;
    }>
  ): Promise<Map<string, string>> {
    return _createBatchChatStream(items);
  }

  static async generateResponse(prompt: string, userId?: string, modelName?: string) {
    return _generateResponse(prompt, userId, modelName);
  }

  static async generateEmbedding(text: string): Promise<number[]> {
    return _generateEmbedding(text);
  }
}