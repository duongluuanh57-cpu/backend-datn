import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../../services/AIService.ts';

export async function generateBrand(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { name } = req.body as { name: string };
    if (!name) return reply.status(400).send({ error: 'Name is required' });

    console.log(`🧠 [AI Workflow] Generating brand/tag details directly with Gemini 3.1 Flash Lite for: ${name}`);
    const geminiPrompt = `
You are an elite luxury brand and taxonomy editor.
Write a detailed historical record, description, and country of origin of the luxury fragrance brand or taxonomy group named "${name}".

Your tasks:
1. True Country of Origin: Suggest the factually correct country of origin (e.g., Chanel -> "Pháp", Gucci -> "Ý", Jo Malone -> "Vương quốc Anh", Tom Ford -> "Mỹ").
2. Exquisite Story/Description: Write a highly elegant, high-end, smooth, and professional brand story or classification description in Vietnamese. 2-3 sentences.
3. Language Control: Output strictly in 100% pure, standard Vietnamese (tiếng Việt). Absolutely NO Chinese characters (Hán tự), Sino-Chinese terms, or mixed languages.
4. Output STRICTLY a valid JSON object conforming to the schema below.
5. Do NOT include markdown code block syntax (like \`\`\`json). Just the raw JSON object.

JSON Schema:
{
  "origin": "Factually correct country of origin in Vietnamese",
  "description": "Exquisite, poetic story or taxonomy description in Vietnamese. 2-3 sentences."
}
`;

    const response = await AIService.generateResponse(geminiPrompt, undefined, 'gemini-3.1-flash-lite');
    let jsonString = response.trim();

    if (jsonString.startsWith('\`\`\`')) {
      jsonString = jsonString.replace(/^\`\`\`json\s*/i, '').replace(/\`\`\`$/, '');
    }

    const brandInfo = JSON.parse(jsonString.trim());

    // Limit brand fields exactly as requested
    brandInfo.logo = '';
    brandInfo.status = 'active';
    brandInfo.featured = false;

    console.log(`✨ [AI Workflow] Gemini 3.1 Brand/Tag Generation Completed!`);
    return reply.status(200).send({ success: true, data: brandInfo });
  } catch (error: any) {
    console.error('AI Brand/Tag Generation Error:', error);
    return reply.status(500).send({ success: false, message: error.message });
  }
}