import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { getGeminiClient, PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL } from './aiClient.ts';

/**
 * identifyProduct - Fallback cascade with retry: Gemini 3.1 Flash Lite exclusively with retry attempts
 */
export async function identifyProduct(image: string, prompt: string): Promise<string> {
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL];
  const maxRetries = 2;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      const attemptNumber = retryCount * modelsToTry.length + i + 1;
      const totalAttempts = (maxRetries + 1) * modelsToTry.length;

      try {
        console.log(`👁️ [AIService] Attempt ${attemptNumber}/${totalAttempts}: Identifying with ${currentModel} (Retry cycle: ${retryCount + 1}/${maxRetries + 1})`);
        const client = getGeminiClient();
        const model = client.getGenerativeModel({ model: currentModel });

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
            continue;
          } else if (!isLastRetry) {
            console.warn(`🔄 [AIService] All models busy in cycle ${retryCount + 1}. Retrying from start (cycle ${retryCount + 2})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            break;
          } else {
            console.error(`❌ [AIService] All models exhausted after ${totalAttempts} attempts. Last error:`, error.message);
            return "";
          }
        } else {
          console.error(`❌ [AIService] Fatal error on ${currentModel}:`, error.message);
          return "";
        }
      }
    }
    retryCount++;
  }

  return "";
}