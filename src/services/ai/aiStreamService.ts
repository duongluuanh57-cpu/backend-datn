import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { getGeminiClient, PRIMARY_MODEL } from './aiClient.ts';
import { geminiLimiter } from '../ConcurrencyLimiter.ts';

/**
 * createChatStream - Retry on Gemini 3.1 Flash Lite with exponential backoff
 */
export async function createChatStream(messages: any[], systemPrompt?: string, image?: string) {
  const maxRetries = 3;

  const tryStream = async () => {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: PRIMARY_MODEL,
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

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const release = await geminiLimiter.acquire(attempt === 1 ? 1 : 0);
      let result;
      try {
        result = await tryStream();
      } finally {
        release();
      }

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
            controller.error(e);
          }
        }
      });

      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

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
      throw error;
    }
  }

  throw new Error('Failed to create chat stream after all retries.');
}

/**
 * createBatchChatStream — Gọi Gemini 1 lần cho NHIỀU câu hỏi
 * Trả về Map<shortId, answerText>
 */
export async function createBatchChatStream(
  items: Array<{
    shortId: string;
    question: string;
    context: string;
    storeOverview: string;
    adaptiveDirective: string;
  }>
): Promise<Map<string, string>> {
  const baseInstruction = `Bạn là Tinco - Trợ lý AI bán nước hoa cao cấp.
Trả lời ngắn gọn, thân thiện, dùng icon :3.
KHÔNG bao giờ nhắc đến từ "Database", "Cơ sở dữ liệu", "Hệ thống".

Lần này bạn nhận NHIỀU câu hỏi từ nhiều khách hàng khác nhau cùng lúc.
Mỗi câu hỏi được đánh dấu bằng [shortId].

QUAN TRỌNG:
- Trả lời TỪNG câu hỏi riêng biệt
- Output là STRICT JSON object, key = shortId, value = câu trả lời
- KHÔNG thêm bất kỳ text nào ngoài JSON
- Câu trả lời phải chứa đúng mã [CARD:id] nếu context có sản phẩm`;

  const questionsBlock = items.map(item => `
[${item.shortId}]
${item.adaptiveDirective}
DỮ LIỆU:
${item.context}
${item.storeOverview}
CÂU HỎI: "${item.question}"
---`).join('\n');

  const batchPrompt = `${baseInstruction}\n\nCÁC CÂU HỎI:\n${questionsBlock}`;

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const release = await geminiLimiter.acquire(1);
      try {
        const client = getGeminiClient();
        const model = client.getGenerativeModel({ model: PRIMARY_MODEL });
        const result = await model.generateContent(batchPrompt);
        const text = result.response.text().trim();
        const parsed = JSON.parse(text);
        const map = new Map<string, string>();
        for (const item of items) {
          const answer = parsed[item.shortId];
          map.set(item.shortId, answer || 'Xin lỗi, mình chưa thể trả lời câu hỏi này ngay bây giờ. Vui lòng thử lại!');
        }
        return map;
      } finally {
        release();
      }
    } catch (err: any) {
      if (attempt < maxRetries && (err.status === 503 || err.status === 429 || err.message?.includes('overloaded'))) {
        const waitTime = 1000 * attempt;
        console.warn(`⚠️ [BatchStream] ${PRIMARY_MODEL} busy (attempt ${attempt}/${maxRetries}). Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to create batch chat stream after all retries.');
}