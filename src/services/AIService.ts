/**
 * AIService — Barrel file (re-export từ các module nhỏ hơn)
 *
 * Code thực tế đã được chuyển sang Vercel AI SDK Interactions API:
 *   - aiInteractionService.ts → createChatStream, generateTextResponse, generateEmbeddingVector, healthCheck
 *   - aiStreamService.ts      → delegate sang aiInteractionService
 *   - aiEmbedding.ts           → delegate sang aiInteractionService
 *   - aiResponseService.ts     → delegate sang aiInteractionService
 *   - aiVisionService.ts       → identifyProduct (giữ lại tạm)
 */
export { createChatStream } from './ai/aiStreamService.ts';
export { generateResponse } from './ai/aiResponseService.ts';
export { generateEmbedding } from './ai/aiEmbedding.ts';
export { identifyProduct } from './ai/aiVisionService.ts';

// Re-import cho backward-compatible class
import { createChatStream as _createChatStream } from './ai/aiStreamService.ts';
import { generateResponse as _generateResponse } from './ai/aiResponseService.ts';
import { generateEmbedding as _generateEmbedding } from './ai/aiEmbedding.ts';
import { healthCheck as _healthCheck } from './ai/aiInteractionService.ts';

// ============================================================
// Backward-compatible AIService class
// Giữ nguyên tên class + method signatures để không break imports
// ============================================================
export class AIService {
  static async healthCheck() {
    return _healthCheck();
  }

  static async createChatStream(messages: any[], systemPrompt?: string, image?: string) {
    return _createChatStream(messages, systemPrompt, image);
  }

  static async generateResponse(prompt: string, userId?: string, modelName?: string) {
    return _generateResponse(prompt, userId, modelName);
  }

  static async generateEmbedding(text: string): Promise<number[]> {
    return _generateEmbedding(text);
  }
}
