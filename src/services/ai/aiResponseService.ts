import { getGeminiClient, PRIMARY_MODEL, CACHE_TTL } from './aiClient.ts';
import { geminiLimiter } from '../ConcurrencyLimiter.ts';
import crypto from 'crypto';

/**
 * Generate a cache key for AI responses
 */
function generateCacheKey(prompt: string, model: string): string {
  return `ai_cache:${crypto.createHash('sha256').update(`${model}:${prompt}`).digest('hex')}`;
}

/**
 * generateResponse - Gemini 3.1 Flash Lite with retry + optional caching
 */
export async function generateResponse(prompt: string, userId?: string, modelName: string = PRIMARY_MODEL) {
  const model = modelName || PRIMARY_MODEL;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const release = await geminiLimiter.acquire(attempt === 1 ? 1 : 0);
      try {
        const client = getGeminiClient();
        const m = client.getGenerativeModel({ model });
        const result = await m.generateContent([prompt]);
        return result.response.text();
      } finally {
        release();
      }
    } catch (error: any) {
      if (
        (error.status === 503 || error.status === 429 || error.message?.includes('overloaded'))
        && attempt < maxRetries
      ) {
        const waitTime = 1000 * attempt;
        console.warn(`⚠️ [AIService] ${model} busy (attempt ${attempt}/${maxRetries}). Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to generate response with ${model} after ${maxRetries} retries.`);
}