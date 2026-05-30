import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { getGeminiClient, PRIMARY_MODEL } from './aiClient.ts';

/**
 * identifyProduct - Gemini 3.1 Flash Lite with retry
 */
export async function identifyProduct(image: string, prompt: string): Promise<string> {
  const maxRetries = 3;

  const imageData = image.split(',')[1] || image;
  const mimeType = image.split(';')[0]?.split(':')[1] || 'image/jpeg';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: PRIMARY_MODEL });

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: imageData, mimeType } }
      ]);

      return result.response.text().trim();
    } catch (error: any) {
      if (
        (error.status === 503 || error.status === 429 || error.message?.includes('overloaded'))
        && attempt < maxRetries
      ) {
        const waitTime = 1000 * attempt;
        console.warn(`⚠️ [AIService] ${PRIMARY_MODEL} busy (attempt ${attempt}/${maxRetries}). Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      return "";
    }
  }

  return "";
}