import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../services/AIService.ts';

export class AIVisionController {
  /**
   * POST /api/ai/scan-gallery-image
   * Vision-based scanning for artistic moment album images.
   * Analyzes an uploaded image's mood, aesthetics, and theme, then auto-generates
   * romantic perfume titles and quotes in both Vietnamese and English.
   */
  static async scanGalleryImage(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { imageUrl } = req.body as { imageUrl: string };

      if (!imageUrl || typeof imageUrl !== 'string') {
        return reply.status(400).send({ success: false, error: 'imageUrl is required' });
      }

      console.log(`📸 [AIVisionController] Scanning homepage gallery image: ${imageUrl.substring(0, 100)}...`);

      let base64Data = '';
      if (imageUrl.startsWith('data:image')) {
        base64Data = imageUrl;
      } else {
        try {
          const res = await fetch(imageUrl);
          if (!res.ok) throw new Error(`HTTP status ${res.status}`);
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
        } catch (fetchErr: any) {
          console.error(`❌ [AIVisionController] Error fetching image from URL:`, fetchErr.message);
          return reply.status(400).send({ success: false, error: `Failed to fetch image URL: ${fetchErr.message}` });
        }
      }

      const prompt = `
You are an elite artistic copywriter and curator for a luxury niche perfume house named L'essence.
Analyze the provided image. Based on the mood, lighting, colors, objects (perfume bottles, flowers, silk, glass, nature, sunlight etc.) and artistic composition of the image:
1. Generate an evocative, extremely poetic, and highly artistic Title in Vietnamese matching the luxury aesthetic of the image (under 5 words). Examples: "Cánh Hồng Sương Sớm", "Giọt Nắng Pha Lê", "Hương Thảo Mộc Niche", "Khay Ngọc Kiêu Kỳ".
2. Generate an evocative, romantic, and philosophical perfume Quote/Statement in Vietnamese matching the title and image theme (under 15 words). Examples: "Sự lãng mạn ẩn mình trong từng nốt hương.", "Hương thơm là tiếng thì thầm của tâm hồn."
3. Translate or adapt the Vietnamese Title into an equally poetic and elegant Title in English (under 5 words). Examples: "Morning Dew Rose", "Crystal Sunlight", "Artisanal Niche", "Vanity Secrets".
4. Translate or adapt the Vietnamese Quote into an equally beautiful, elegant, and romantic perfume Quote/Statement in English (under 15 words). Examples: "Romance hidden in every single note.", "Scent is the whisper of the soul."

Output STRICTLY a valid JSON object matching the schema below. Do NOT include markdown code block syntax (like \`\`\`json). Just the raw JSON object.

JSON Schema:
{
  "titleVi": "artistic title in Vietnamese",
  "quoteVi": "artistic quote in Vietnamese",
  "titleEn": "artistic title in English",
  "quoteEn": "artistic quote in English"
}
      `.trim();

      const aiResponse = await AIService.identifyProduct(base64Data, prompt);
      
      let jsonString = aiResponse.trim();
      if (jsonString.startsWith('\`\`\`')) {
        jsonString = jsonString.replace(/^\`\`\`json\s*/i, '').replace(/\`\`\`$/, '');
      }

      const result = JSON.parse(jsonString.trim());
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      console.error('❌ [AIVisionController.scanGalleryImage Error]:', error);
      return reply.status(500).send({ success: false, error: error.message || 'Internal Server Error' });
    }
  }
}
