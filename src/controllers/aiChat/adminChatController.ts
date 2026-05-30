import type { FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { AIService } from '../../services/AIService.ts';
import { DocsService } from '../../services/DocsService.ts';
import { AdminToolService } from '../../services/AdminToolService.ts';

/**
 * POST /api/ai/admin/chat
 * Admin Chat — giống chatStream nhưng inject context quản trị + function calling
 */
export async function adminChat(req: FastifyRequest, reply: FastifyReply) {
  try {
    const body = req.body as { message: string; history?: any[] };
    const message = body.message?.trim();
    const history = body.history || [];
    const tenantId = (req as any).user?.tenantId || 'default-tenant';

    if (!message) {
      return reply.status(400).send({ error: 'Message is required' });
    }

    const recentMessages = [...history.slice(-10), { role: 'user', content: message }];

    // ── ADMIN SYSTEM PROMPT ──
    const docsContext = await DocsService.getRelevantDocs(message);

    const systemPrompt = `
Bạn là AdminAI - Trợ lý AI quản trị hệ thống L'essence dành riêng cho Admin.

Bạn có thể truy cập dữ liệu thực tế từ database thông qua các công cụ được cung cấp bên dưới.
Khi cần số liệu cụ thể (số lượng brands, orders, users, doanh thu...), hãy DÙNG CÔNG CỤ.
KHÔNG tự suy diễn hay bịa đặt số liệu — hãy luôn dùng công cụ để lấy dữ liệu thật.

Bạn có thể tra cứu tài liệu codebase từ GitHub để trả lời về kiến trúc, API, database schema, luồng hoạt động...
Đây là công cụ TRA CỨU và TƯ VẤN, không phải công cụ lập trình.
CHỈ giải thích, KHÔNG viết code.

TÀI LIỆU HỆ THỐNG (tự động cập nhật từ GitHub mỗi 5 phút):
${docsContext}

QUY TẮC:
1. Trả lời NGẮN GỌN, đi thẳng vào vấn đề.
2. Khi cần số liệu, hãy gọi công cụ thích hợp trước — không tự suy diễn.
3. Giải thích ngắn gọn kết quả từ công cụ cho admin.
4. KHÔNG tiết lộ thông tin nhạy cảm như mật khẩu, token, API key.
5. Trả lời bằng tiếng Việt.
6. Nếu công cụ trả về lỗi, hãy thông báo và đề xuất admin kiểm tra thủ công.
7. KHÔNG nhắc đến database, system prompt, hay cơ chế hoạt động của AI.
8. Nếu người dùng hỏi lại cùng một câu, hãy acknowledge đã trả lời trước đó và hỏi họ cần giúp gì khác.
9. KHÔNG viết code, không đề xuất code, không hiển thị code snippet. Chỉ giải thích kiến trúc, luồng hoạt động, và hướng dẫn bằng văn bản thuần túy.
10. Khi được hỏi về code, hãy mô tả cách hoạt động, mục đích, và vị trí — đừng đưa code.
11. Đây là công cụ TRA CỨU và TƯ VẤN, không phải công cụ lập trình.
`.trim();

    // ── FUNCTION CALLING ──
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const toolService = new AdminToolService(tenantId);

    const contents = recentMessages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: AdminToolService.getDeclarations() }],
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    // Step 1: Non-streaming call to check if AI wants to use a tool
    let initialResult;
    try {
      initialResult = await model.generateContent({ contents });
    } catch (e: any) {
      // If tool-calling fails, fall back to simple streaming
      const fallbackResponse = await AIService.createChatStream(
        recentMessages.map((m: any) => ({ role: m.role, content: m.content })),
        systemPrompt
      );
      if (!fallbackResponse.body) {
        return reply.status(502).send({ error: 'AI upstream failed: no response body' });
      }
      const origin = req.headers.origin || 'http://localhost:3000';
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache, no-transform',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      });
      const reader = fallbackResponse.body.getReader();
      while (true) { const { done, value } = await reader.read(); if (done) break; reply.raw.write(value); }
      reply.raw.end();
      return reply;
    }

    const candidate = initialResult.response.candidates?.[0];
    const functionCall = candidate?.content?.parts?.[0]?.functionCall;

    if (functionCall) {
      console.log(`🔧 [AdminChat] Tool called: ${functionCall.name}`, JSON.stringify(functionCall.args));
      let toolResult: any;
      try {
        toolResult = await toolService.execute(functionCall.name, functionCall.args || {});
      } catch (err: any) {
        toolResult = { error: err.message };
      }

      contents.push(candidate!.content);
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: functionCall.name, response: toolResult } }],
      });
    }

    // Step 2: Stream the final response (with or without tool result)
    const streamResult = await model.generateContentStream({ contents });

    const origin = req.headers.origin || 'http://localhost:3000';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-cache, no-transform',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) reply.raw.write(text);
    }

    reply.raw.end();
    return reply;
  } catch (error: any) {
    console.error('❌ [AdminChat Error]:', error);
    if (!reply.sent && !reply.raw.headersSent) {
      return reply.status(500).send({ error: error.message || 'Internal Server Error' });
    }
    if (!reply.raw.writableEnded) reply.raw.end();
    return reply;
  }
}