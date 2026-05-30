import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { getGeminiClient, PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL } from './aiClient.ts';
import { geminiLimiter } from '../ConcurrencyLimiter.ts';

/**
 * createChatStream - Fallback cascade with retry: Gemini 3.1 Flash Lite exclusively with retry attempts
 */
export async function createChatStream(messages: any[], systemPrompt?: string, image?: string) {
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL];
  const maxRetries = 2;
  let retryCount = 0;

  const tryStream = async (mName: string) => {
    console.log(`🌊 [AIService] Opening Stream with: ${mName}`);
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
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

        // Acquire concurrency slot trước khi gọi Gemini
        const release = await geminiLimiter.acquire(attemptNumber === 1 ? 1 : 0);
        let result;
        try {
          result = await tryStream(currentModel);
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

  throw new Error('Failed to create chat stream with any available model after all retries.');
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

  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK_MODEL];
  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      const release = await geminiLimiter.acquire(1);
      try {
        const client = getGeminiClient();
        const model = client.getGenerativeModel({ model: modelName });
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
      lastError = err;
      console.warn(`⚠️ [BatchStream] ${modelName} failed:`, err.message);
      continue;
    }
  }
  throw lastError || new Error('All models failed for batch chat stream');
}