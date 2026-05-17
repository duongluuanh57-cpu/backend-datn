import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { redis } from '../config/redis.ts';
import crypto from 'crypto';

export class AIService {
  private static _genAI: GoogleGenerativeAI;
  private static CACHE_TTL = 60 * 60 * 24;
  private static PRIMARY_MODEL = 'gemini-3.1-flash-lite';
  private static FALLBACK_MODEL = 'gemma-4-31b';
  private static SECONDARY_FALLBACK_MODEL = 'gemma-4-26b';

  private static get client() {
    if (!this._genAI) {
      this._genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    }
    return this._genAI;
  }

  private static generateCacheKey(prompt: string, model: string): string {
    return `ai_cache:${crypto.createHash('sha256').update(`${model}:${prompt}`).digest('hex')}`;
  }

  /**
   * identifyProduct - Fallback cascade with retry: Gemini 3.1 → Gemma 4 31B → Gemma 4 26B → Retry from start
   */
  static async identifyProduct(image: string, prompt: string): Promise<string> {
    const modelsToTry = [this.PRIMARY_MODEL, this.FALLBACK_MODEL, this.SECONDARY_FALLBACK_MODEL];
    const maxRetries = 2; // Số lần retry toàn bộ cascade
    let retryCount = 0;

    // Retry loop - xoay vòng qua tất cả models nhiều lần
    while (retryCount <= maxRetries) {
      for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        const attemptNumber = retryCount * modelsToTry.length + i + 1;
        const totalAttempts = (maxRetries + 1) * modelsToTry.length;

        try {
          console.log(`👁️ [AIService] Attempt ${attemptNumber}/${totalAttempts}: Identifying with ${currentModel} (Retry cycle: ${retryCount + 1}/${maxRetries + 1})`);
          const model = this.client.getGenerativeModel({ model: currentModel });

          const imageData = image.split(',')[1] || image;
          const mimeType = image.split(';')[0]?.split(':')[1] || 'image/jpeg';

          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: imageData,
                mimeType: mimeType
              }
            }
          ]);

          const text = result.response.text().trim();
          console.log(`✅ [AIService] Identification successful with: ${currentModel} (after ${attemptNumber} attempts)`);
          return text;

        } catch (error: any) {
          const isLastModelInCycle = i === modelsToTry.length - 1;
          const isLastRetry = retryCount === maxRetries;
          const nextModel = modelsToTry[(i + 1) % modelsToTry.length];

          if (error.status === 503 || error.status === 429 || error.message?.includes('high demand') || error.message?.includes('overloaded')) {
            if (!isLastModelInCycle) {
              console.warn(`⚠️ [AIService] ${currentModel} is busy/overloaded. Trying next: ${nextModel}...`);
              continue; // Try next model in current cycle
            } else if (!isLastRetry) {
              console.warn(`🔄 [AIService] All models busy in cycle ${retryCount + 1}. Retrying from start (cycle ${retryCount + 2})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
              break; // Break inner loop to start next retry cycle
            } else {
              console.error(`❌ [AIService] All models exhausted after ${totalAttempts} attempts. Last error:`, error.message);
              return ""; // Return empty string instead of throwing
            }
          } else {
            // Non-recoverable error
            console.error(`❌ [AIService] Fatal error on ${currentModel}:`, error.message);
            return ""; // Return empty string instead of throwing
          }
        }
      }
      retryCount++;
    }

    return ""; // Fallback return
  }

  /**
   * createChatStream - Fallback cascade with retry: Gemini 3.1 → Gemma 4 31B → Gemma 4 26B → Retry from start
   */
  static async createChatStream(messages: any[], systemPrompt?: string, image?: string) {
    const modelsToTry = [this.PRIMARY_MODEL, this.FALLBACK_MODEL, this.SECONDARY_FALLBACK_MODEL];
    const maxRetries = 2; // Số lần retry toàn bộ cascade
    let retryCount = 0;

    const tryStream = async (mName: string) => {
      console.log(`🌊 [AIService] Opening Stream with: ${mName}`);
      const model = this.client.getGenerativeModel({
        model: mName,
        systemInstruction: systemPrompt || "Bạn là trợ lý AI chuyên nghiệp.",
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      });

      const contents = messages
        .filter(m => m.role === 'user' || m.role === 'model' || m.role === 'assistant')
        .map((m, index) => {
          const parts: any[] = [{ text: m.content || "" }];
          if (index === messages.length - 1 && image && m.role === 'user') {
            const imageData = image.split(',')[1] || image;
            const mimeType = image.split(';')[0]?.split(':')[1] || 'image/jpeg';
            parts.push({
              inlineData: { data: imageData, mimeType: mimeType }
            });
          }
          return { role: m.role === 'user' ? 'user' : 'model', parts };
        });

      return await model.generateContentStream({ contents });
    };

    // Retry loop - xoay vòng qua tất cả models nhiều lần
    while (retryCount <= maxRetries) {
      for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        const attemptNumber = retryCount * modelsToTry.length + i + 1;
        const totalAttempts = (maxRetries + 1) * modelsToTry.length;

        try {
          console.log(`🎯 [AIService] Attempt ${attemptNumber}/${totalAttempts}: ${currentModel} (Retry cycle: ${retryCount + 1}/${maxRetries + 1})`);
          const result = await tryStream(currentModel);

          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              try {
                for await (const chunk of result.stream) {
                  const text = chunk.text();
                  if (text) controller.enqueue(encoder.encode(text));
                }
                controller.close();
              } catch (e: any) {
                console.error(`❌ Stream Inner Error on ${currentModel}:`, e.message);
                controller.error(e);
              }
            }
          });

          console.log(`✅ [AIService] Stream successful with: ${currentModel} (after ${attemptNumber} attempts)`);
          return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

        } catch (error: any) {
          const isLastModelInCycle = i === modelsToTry.length - 1;
          const isLastRetry = retryCount === maxRetries;
          const nextModel = modelsToTry[(i + 1) % modelsToTry.length];

          if (error.status === 503 || error.status === 429 || error.message?.includes('high demand') || error.message?.includes('overloaded')) {
            if (!isLastModelInCycle) {
              console.warn(`⚠️ [AIService] ${currentModel} is busy/overloaded. Trying next: ${nextModel}...`);
              continue; // Try next model in current cycle
            } else if (!isLastRetry) {
              console.warn(`🔄 [AIService] All models busy in cycle ${retryCount + 1}. Retrying from start (cycle ${retryCount + 2})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
              break; // Break inner loop to start next retry cycle
            } else {
              console.error(`❌ [AIService] All models exhausted after ${totalAttempts} attempts. Last error:`, error.message);
              throw new Error(`All AI models are currently unavailable after ${totalAttempts} attempts. Please try again later.`);
            }
          } else {
            // Non-recoverable error, throw immediately
            console.error(`❌ [AIService] Fatal error on ${currentModel}:`, error.message);
            throw error;
          }
        }
      }
      retryCount++;
    }

    // Should never reach here, but just in case
    throw new Error('Failed to create chat stream with any available model after all retries.');
  }

  /**
   * generateResponse - Fallback cascade with retry: Gemini 3.1 → Gemma 4 31B → Gemma 4 26B → Retry from start
   */
  static async generateResponse(prompt: string, userId?: string, modelName: string = 'gemini-3.1-flash-lite') {
    // If a specific model is requested, try only that model (no fallback)
    if (modelName !== this.PRIMARY_MODEL) {
      try {
        const model = this.client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error: any) {
        console.error(`❌ [AIService] Error with requested model ${modelName}:`, error.message);
        throw error;
      }
    }

    // Otherwise, use cascade fallback with retry
    const modelsToTry = [this.PRIMARY_MODEL, this.FALLBACK_MODEL, this.SECONDARY_FALLBACK_MODEL];
    const maxRetries = 2; // Số lần retry toàn bộ cascade
    let retryCount = 0;

    // Retry loop - xoay vòng qua tất cả models nhiều lần
    while (retryCount <= maxRetries) {
      for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        const attemptNumber = retryCount * modelsToTry.length + i + 1;
        const totalAttempts = (maxRetries + 1) * modelsToTry.length;

        try {
          console.log(`🎯 [AIService] Attempt ${attemptNumber}/${totalAttempts}: ${currentModel} (Retry cycle: ${retryCount + 1}/${maxRetries + 1})`);
          const model = this.client.getGenerativeModel({ model: currentModel });
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          
          console.log(`✅ [AIService] generateResponse successful with: ${currentModel} (after ${attemptNumber} attempts)`);
          return text;

        } catch (error: any) {
          const isLastModelInCycle = i === modelsToTry.length - 1;
          const isLastRetry = retryCount === maxRetries;
          const nextModel = modelsToTry[(i + 1) % modelsToTry.length];

          if (error.status === 503 || error.status === 429 || error.message?.includes('high demand') || error.message?.includes('overloaded')) {
            if (!isLastModelInCycle) {
              console.warn(`⚠️ [AIService] ${currentModel} is busy/overloaded. Trying next: ${nextModel}...`);
              continue; // Try next model in current cycle
            } else if (!isLastRetry) {
              console.warn(`🔄 [AIService] All models busy in cycle ${retryCount + 1}. Retrying from start (cycle ${retryCount + 2})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
              break; // Break inner loop to start next retry cycle
            } else {
              console.error(`❌ [AIService] All models exhausted after ${totalAttempts} attempts. Last error:`, error.message);
              throw new Error(`All AI models are currently unavailable after ${totalAttempts} attempts. Please try again later.`);
            }
          } else {
            // Non-recoverable error, throw immediately
            console.error(`❌ [AIService] Fatal error on ${currentModel}:`, error.message);
            throw error;
          }
        }
      }
      retryCount++;
    }

    // Should never reach here, but just in case
    throw new Error('Failed to generate response with any available model after all retries.');
  }

  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embeddingModel = this.client.getGenerativeModel({ model: "gemini-embedding-2" });
      const result = await embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      return new Array(768).fill(0);
    }
  }
}
