import { getGeminiClient, PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL, CACHE_TTL } from './aiClient.ts';
import { geminiLimiter } from '../ConcurrencyLimiter.ts';
import crypto from 'crypto';
import { redis } from '../../config/redis.ts';

/**
 * Generate a cache key for AI responses
 */
function generateCacheKey(prompt: string, model: string): string {
  return `ai_cache:${crypto.createHash('sha256').update(`${model}:${prompt}`).digest('hex')}`;
}

/**
 * generateResponse - Fallback cascade with retry: Gemini 3.1 Flash Lite exclusively with retry attempts
 */
export async function generateResponse(prompt: string, userId?: string, modelName: string = 'gemini-3.1-flash-lite') {
  console.log(`🔍 [AIService DEBUG] generateResponse received prompt:`, {
    type: typeof prompt,
    isNull: prompt === null,
    isUndefined: prompt === undefined,
    isNaN: typeof prompt === 'number' && isNaN(prompt),
    valueStr: String(prompt).substring(0, 100),
    length: typeof prompt === 'string' ? prompt.length : 'N/A'
  });

  // If a specific model is requested, try with retry (3 attempts with exponential backoff)
  if (modelName !== PRIMARY_MODEL) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎯 [AIService] Attempt ${attempt}/${maxRetries}: ${modelName}`);
        const client = getGeminiClient();
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([prompt]);
        const text = result.response.text();
        console.log(`✅ [AIService] Success with ${modelName} on attempt ${attempt}`);
        return text;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;

        if (error.status === 503 || error.status === 429 || error.message?.includes('high demand') || error.message?.includes('overloaded')) {
          if (!isLastAttempt) {
            const waitTime = 1000 * attempt;
            console.warn(`⚠️ [AIService] ${modelName} is busy/overloaded. Retrying in ${waitTime}ms... (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else {
            console.error(`❌ [AIService] ${modelName} exhausted after ${maxRetries} attempts. Last error:`, error.message);
            throw new Error(`${modelName} is currently unavailable after ${maxRetries} attempts. Please try again later.`);
          }
        } else {
          console.error(`❌ [AIService] Fatal error on ${modelName}:`, error.message);
          throw error;
        }
      }
    }
  }

  // Otherwise, use cascade fallback with retry
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL];
  const maxRetries = 2;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      const attemptNumber = retryCount * modelsToTry.length + i + 1;
      const totalAttempts = (maxRetries + 1) * modelsToTry.length;

      try {
        console.log(`🎯 [AIService] Attempt ${attemptNumber}/${totalAttempts}: ${currentModel} (Retry cycle: ${retryCount + 1}/${maxRetries + 1})`);
        const release = await geminiLimiter.acquire(attemptNumber === 1 ? 1 : 0);
        try {
          const client = getGeminiClient();
          const model = client.getGenerativeModel({ model: currentModel });
          const result = await model.generateContent([prompt]);
          const text = result.response.text();
          console.log(`✅ [AIService] generateResponse successful with: ${currentModel} (after ${attemptNumber} attempts)`);
          return text;
        } finally {
          release();
        }

      } catch (error: any) {
        const isLastModelInCycle = i === modelsToTry.length - 1;
        const isLastRetry = retryCount === maxRetries;
        const nextModel = modelsToTry[(i + 1) % modelsToTry.length];

        if (error.status === 503 || error.status === 429 || error.message?.includes('high demand') || error.message?.includes('overloaded')) {
          if (!isLastModelInCycle) {
            console.warn(`⚠️ [AIService] ${currentModel} is busy/overloaded. Trying next: ${nextModel}...`);
            continue;
          } else if (!isLastRetry) {
            console.warn(`🔄 [AIService] All models busy in cycle ${retryCount + 1}. Retrying from start (cycle ${retryCount + 2})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            break;
          } else {
            console.error(`❌ [AIService] All models exhausted after ${totalAttempts} attempts. Last error:`, error.message);
            throw new Error(`All AI models are currently unavailable after ${totalAttempts} attempts. Please try again later.`);
          }
        } else {
          console.error(`❌ [AIService] Fatal error on ${currentModel}:`, error.message);
          throw error;
        }
      }
    }
    retryCount++;
  }

  throw new Error('Failed to generate response with any available model after all retries.');
}