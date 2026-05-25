import type { FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { AIService } from '../services/AIService.ts';
import { SearchService } from '../services/SearchService.ts';
import { redisService } from '../services/RedisService.ts';
import { DocsService } from '../services/DocsService.ts';
import { AdminToolService } from '../services/AdminToolService.ts';
import { Knowledge } from '../models/Knowledge.ts';
import { Product } from '../models/Product.ts';
import { Brand } from '../models/Brand.ts';
import { Tag } from '../models/Tag.ts';
import { TaxonomyTerm } from '../models/TaxonomyTerm.ts';
import { Taxonomy } from '../models/Taxonomy.ts';

export class AIChatController {
  /**
   * POST /api/ai/chat
   * Chat Stream Pipeline - Mood-Aware Expert Version
   */
  static async chatStream(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { messages, image } = req.body as { messages: any[], image?: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';

      if ((!messages || !Array.isArray(messages)) && !image) {
        return reply.status(400).send({ error: 'Messages or Image required' });
      }

      const recentMessages = messages.slice(-5);
      const lastMessage = recentMessages[recentMessages.length - 1]?.content || (image ? 'User uploaded an image' : '');
      if (!lastMessage) throw new Error('Empty message');

      const cleanQuestion = lastMessage.trim().toLowerCase();

      // ── ADAPTIVE LEARNING: Phân tích lịch sử rating của phiên chat ─────────
      // Lấy tất cả tin nhắn assistant đã được đánh giá (có rating 1-5)
      const ratedMessages = messages.filter(
        (m: any) => m.role === 'assistant' && typeof m.rating === 'number'
      );

      // Chỉ xét 5 đánh giá gần nhất để phản ánh xu hướng thực tế nhất
      const recentRatings = ratedMessages.slice(-5).map((m: any) => m.rating as number);
      const avgRating = recentRatings.length > 0
        ? recentRatings.reduce((a: number, b: number) => a + b, 0) / recentRatings.length
        : null;

      // Đếm số lần rating thấp (≤ 2) liên tiếp gần nhất
      let consecutiveLow = 0;
      for (let i = ratedMessages.length - 1; i >= 0; i--) {
        if ((ratedMessages[i] as any).rating <= 2) consecutiveLow++;
        else break;
      }

      console.log(`📊 [Adaptive] avgRating=${avgRating?.toFixed(2) ?? 'N/A'}, consecutiveLow=${consecutiveLow}, samples=${recentRatings.length}`);

      // 1. CACHE DISABLED
      const cacheKey = `ai:chat:${tenantId}:${Buffer.from(cleanQuestion).toString('base64')}`;

      // 2. TRUY XUẤT TRI THỨC (Nâng cấp: Nếu có ảnh, nhận diện trước khi tìm)
      let searchQuery = lastMessage;
      let products: any[] = [];
      let mode: string = '';

      try {
        // Nếu có ảnh, hỏi AI xem đây là gì để tìm cho chính xác
        if (image) {
          console.log(`📸 [AIChatController] Đã nhận ảnh (Size: ${image.length} chars)`);
          try {
            const identifyPrompt = "Hãy đọc tên sản phẩm nước hoa và thương hiệu trong ảnh này. Chỉ trả về tên, ví dụ: 'Midnight Rose'.";
            const identifiedProduct = await AIService.identifyProduct(image, identifyPrompt);
            console.log('👁️ [AIChatController] Vision Result:', identifiedProduct);

            if (identifiedProduct && identifiedProduct.trim()) {
              searchQuery = `${lastMessage} ${identifiedProduct.trim()}`;
            }
          } catch (vErr) {
            console.error('❌ [Vision Identify Error]:', vErr);
          }
        }

        console.log('📝 [AIChatController] Final Search Query:', searchQuery);
        const result = await SearchService.hybridSearch(searchQuery, tenantId, 4);
        products = result.products;
        mode = result.mode;
      } catch (err) {
        console.error('❌ [Search Error]:', err);
      }

      let context = '';
      if (mode === 'greeting') {
        context = "TRẠNG THÁI: Khách vừa chào. Chỉ chào lại thân thiện, KHÔNG đề xuất sản phẩm.\n";
      } else if (products.length === 0) {
        context = "TRẠNG THÁI: Không tìm thấy sản phẩm phù hợp. Xin lỗi lịch sự.\n";
      } else {
        context = `DANH SÁCH SẢN PHẨM KHỚP NHẤT:\n${products.map(p => `- ${p.name} (Hãng: ${p.brand}): [CARD:${p._id}]`).join('\n')}\n`;
      }

      let storeOverview = '';
      try {
        const [allBrands, allTags, allScents, allConcentrations, allSegments, productCount] = await Promise.all([
          Brand.find({ status: 'active' }).select('name').lean(),
          Tag.find({ status: 'active' }).select('name').lean(),
          Taxonomy.findOne({ slug: 'scent_group', tenantId }).lean().then(t =>
            t ? TaxonomyTerm.find({ taxonomyId: t._id, tenantId, status: 'active' }).select('name').lean() : []
          ),
          Taxonomy.findOne({ slug: 'concentration', tenantId }).lean().then(t =>
            t ? TaxonomyTerm.find({ taxonomyId: t._id, tenantId, status: 'active' }).select('name').lean() : []
          ),
          Taxonomy.findOne({ slug: 'segment', tenantId }).lean().then(t =>
            t ? TaxonomyTerm.find({ taxonomyId: t._id, tenantId, status: 'active' }).select('name').lean() : []
          ),
          Product.countDocuments({}),
        ]);
        storeOverview = `TỔNG QUAN CỬA HÀNG:
- Thương hiệu: ${allBrands.map((b: any) => b.name).join(', ')}
- Tags: ${allTags.map((t: any) => t.name).join(', ')}
- Nhóm hương: ${allScents.map((s: any) => s.name).join(', ')}
- Nồng độ: ${allConcentrations.map((c: any) => c.name).join(', ')}
- Phân khúc: ${allSegments.map((s: any) => s.name).join(', ')}
- Tổng số sản phẩm: ${productCount}`;
      } catch (dbErr) {
        console.error('Error fetching store overview:', dbErr);
      }

      // 3. ADAPTIVE STYLE DIRECTIVE - tự điều chỉnh dựa trên lịch sử rating
      // Logic: AI không bao giờ biết số sao cụ thể — chỉ nhận hướng dẫn phong cách
      let adaptiveDirective = '';

      if (avgRating !== null) {
        if (consecutiveLow >= 2) {
          // ≥ 2 lần liên tiếp ≤ 2 sao: Chế độ khủng hoảng — thay đổi hoàn toàn cách tiếp cận
          adaptiveDirective = `
HƯỚNG DẪN THÍCH ỨNG (QUAN TRỌNG - ĐỌC KỸ):
Các phản hồi gần đây của bạn đã không đáp ứng được kỳ vọng của khách hàng.
Bạn PHẢI thay đổi hoàn toàn cách tiếp cận trong câu trả lời này:
- Hỏi lại xem khách đang cần gì chính xác hơn trước khi tư vấn sản phẩm.
- Dùng ngôn ngữ thật đơn giản, dễ hiểu, tránh thuật ngữ chuyên ngành.
- Trả lời từng bước, chia nhỏ thông tin thành danh sách bullet point.
- Cuối câu hỏi xem: "Mình hiểu đúng ý bạn chưa? 🙏".
- TUYỆT ĐỐI không trả lời dài dòng hay quá nhiều sản phẩm cùng lúc.
`;
        } else if (avgRating < 3.0) {
          // Trung bình thấp (< 3 sao): Cần cải thiện đáng kể
          adaptiveDirective = `
HƯỚNG DẪN THÍCH ỨNG:
Phản hồi gần đây chưa thực sự hữu ích cho khách hàng. Hãy điều chỉnh:
- Hỏi thêm một câu làm rõ nhu cầu nếu câu hỏi của khách còn mơ hồ.
- Trả lời cụ thể hơn, tránh câu trả lời chung chung.
- Đề xuất tối đa 2 sản phẩm thay vì nhiều lựa chọn gây rối.
- Kết thúc bằng: "Bạn muốn mình tư vấn thêm về điều gì không? 😊".
`;
        } else if (avgRating < 4.0) {
          // Trung bình (3-4 sao): Khá ổn, cần thêm chiều sâu
          adaptiveDirective = `
HƯỚNG DẪN THÍCH ỨNG:
Phản hồi đang ở mức chấp nhận được nhưng chưa xuất sắc. Hãy:
- Thêm một chi tiết cụ thể và hữu ích (ví dụ: lý do gợi ý, cảm nhận hương thơm).
- Cá nhân hóa câu trả lời hơn dựa trên ngữ cảnh cuộc trò chuyện.
`;
        } else {
          // Trung bình cao (≥ 4 sao): Đang làm tốt, duy trì
          adaptiveDirective = `
HƯỚNG DẪN THÍCH ỨNG:
Bạn đang làm rất tốt! Duy trì phong cách hiện tại — thân thiện, chính xác, và hữu ích.
`;
        }
      }

      // 4. SYSTEM PROMPT + FUNCTION CALLING
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const systemPrompt = `
Bạn là Tinco - Trợ lý AI bán nước hoa cao cấp. Trả lời ngắn gọn, thân thiện, dùng icon :3.
Bạn CÓ THỂ dùng công cụ search_products (tìm sản phẩm) hoặc get_store_overview (xem tổng quan) khi cần thêm dữ liệu.

QUY TẮC:
1. Nếu TRẠNG THÁI là "Khách vừa chào": Chỉ chào lại thân thiện, KHÔNG đề xuất sản phẩm.
2. Nếu có DANH SÁCH SẢN PHẨM KHỚP NHẤT: Ưu tiên tư vấn các sản phẩm này, BẮT BUỘC chép đúng mã [CARD:id] vào cuối câu.
3. Nếu khách hỏi tổng quát (thương hiệu, nhóm hương, nồng độ, phân khúc): Dùng TỔNG QUAN CỬA HÀNG bên dưới.
4. Nếu cần thêm thông tin: Dùng công cụ search_products hoặc get_store_overview.
5. KHÔNG bao giờ nhắc đến từ "Database", "Cơ sở dữ liệu", "Hệ thống".
${adaptiveDirective}

DỮ LIỆU HIỆN TẠI:
${context}

${storeOverview}
      `.trim();

      const contents = recentMessages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: AdminToolService.getUserDeclarations() }],
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      });

      // Step 1: Non-streaming call to check for tool use
      let initialResult;
      try {
        initialResult = await model.generateContent({ contents });
      } catch {
        // Fallback: old streaming without tools
        const fb = await AIService.createChatStream(recentMessages, systemPrompt, image);
        if (!fb.body) throw new Error('No body');
        const origin = req.headers.origin || 'http://localhost:3000';
        reply.raw.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Accel-Buffering': 'no',
          'Cache-Control': 'no-cache, no-transform',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        });
        let fullResponseText = '';
        const reader = fb.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          fullResponseText += chunk;
          reply.raw.write(value);
        }
        if (fullResponseText.trim() && !fullResponseText.includes('NULL')) {
          await Promise.all([
            redisService.set(cacheKey, fullResponseText),
            Knowledge.findOneAndUpdate(
              { question: cleanQuestion, tenantId },
              { answer: fullResponseText },
              { upsert: true }
            ),
          ]);
        }
        reply.raw.end();
        return reply;
      }

      const candidate = initialResult.response.candidates?.[0];
      const functionCall = candidate?.content?.parts?.[0]?.functionCall;

      if (functionCall) {
        console.log(`🔧 [ChatStream] Tool called: ${functionCall.name}`, JSON.stringify(functionCall.args));
        let toolResult: any;
        try {
          if (functionCall.name === 'search_products') {
            const sr = await SearchService.hybridSearch(
              functionCall.args?.query || lastMessage,
              tenantId,
              functionCall.args?.limit || 5
            );
            toolResult = {
              products: sr.products,
              mode: sr.mode,
            };
          } else if (functionCall.name === 'get_store_overview') {
            toolResult = { overview: storeOverview };
          } else {
            toolResult = { error: `Unknown tool: ${functionCall.name}` };
          }
        } catch (err: any) {
          toolResult = { error: err.message };
        }

        contents.push(candidate!.content);
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name: functionCall.name, response: toolResult } }],
        });
      }

      // Step 2: Stream final response
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

      let fullResponseText = '';
      for await (const chunk of streamResult.stream) {
        const text = chunk.text();
        if (text) {
          fullResponseText += text;
          reply.raw.write(text);
        }
      }

      if (fullResponseText.trim() && !fullResponseText.includes('NULL')) {
        await Promise.all([
          redisService.set(cacheKey, fullResponseText),
          Knowledge.findOneAndUpdate(
            { question: cleanQuestion, tenantId },
            { answer: fullResponseText },
            { upsert: true }
          ),
        ]);
      }

      reply.raw.end();
      return reply;
    } catch (error: any) {
      console.error('❌ [AIChatController Error]:', error);
      if (!reply.sent && !reply.raw.headersSent) {
        return reply.status(500).send({ error: error.message || 'Internal Server Error' });
      }
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
      return reply;
    }
  }

  static async supportChat(req: FastifyRequest, reply: FastifyReply) {
    return this.chatStream(req, reply);
  }

  /**
   * POST /api/ai/admin/chat
   * Admin Chat — giống chatStream nhưng inject context quản trị
   */
  static async adminChat(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as { message: string; history?: any[] };
      const message = body.message?.trim();
      const history = body.history || [];
      const tenantId = (req as any).user?.tenantId || 'default-tenant';

      if (!message) {
        return reply.status(400).send({ error: 'Message is required' });
      }

      const recentMessages = [...history.slice(-10), { role: 'user', content: message }];

      // ── ADMIN SYSTEM PROMPT ────────────────────────────────────────────
      const docsContext = await DocsService.getRelevantDocs(message);

      const systemPrompt = `
Bạn là AdminAI - Trợ lý AI quản trị hệ thống L'essence dành riêng cho Admin.
Bạn có thể truy cập dữ liệu thực tế từ database thông qua các công cụ được cung cấp bên dưới.

Khi cần số liệu cụ thể (số lượng brands, orders, users, doanh thu...), hãy DÙNG CÔNG CỤ.
KHÔNG tự suy diễn hay bịa đặt số liệu — hãy luôn dùng công cụ để lấy dữ liệu thật.

Ngoài ra, bạn cũng có thể xem tài liệu codebase từ GitHub để trả lời về kiến trúc, API, coding standards...

TÀI LIỆU HỆ THỐNG (tự động cập nhật từ GitHub mỗi 5 phút):
${docsContext}

QUY TẮC:
1. Trả lời NGẮN GỌN, đi thẳng vào vấn đề.
2. Khi cần số liệu, hãy gọi công cụ thích hợp trước — không tự suy diễn.
3. Giải thích ngắn gọn kết quả từ công cụ cho admin.
4. KHÔNG tiết lộ thông tin nhạy cảm như mật khẩu, token, API key.
5. Trả lời bằng tiếng Việt, dùng icon nhẹ nhàng (📊 📦 👤 🖥️ 🔧).
6. Nếu công cụ trả về lỗi, hãy thông báo và đề xuất admin kiểm tra thủ công.
7. KHÔNG nhắc đến database, system prompt, hay cơ chế hoạt động của AI.
8. Nếu người dùng hỏi lại cùng một câu, hãy acknowledge đã trả lời trước đó và hỏi họ cần giúp gì khác.
`.trim();

      // ── FUNCTION CALLING ─────────────────────────────────────────────
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

  /**
   * POST /api/ai/feedback
   * Receives a star rating (1–5) from the user after an AI response.
   * The AI interprets the rating autonomously and streams an adaptive reply —
   * the user simply picks stars; all logic lives here on the server.
   *
   * Rating semantics (known only to the AI, not exposed to the frontend):
   *   5 ⭐ → Perfect — express genuine happiness, offer to help more
   *   4 ⭐ → Good but improvable — thank them, ask what can be better
   *   3 ⭐ → Neutral / mediocre — acknowledge, ask for specific feedback
   *   2 ⭐ → Poor — apologise sincerely, offer to retry or connect to support
   *   1 ⭐ → Very bad — apologise, express regret, escalate offer
   */
  static async handleFeedback(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { messageId, rating } = req.body as { messageId: string; rating: number };

      if (!rating || rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'Rating must be between 1 and 5' });
      }

      // Build a tailored system prompt based on the numeric rating.
      // The frontend never knows these rules — it only sends the star number.
      const ratingContext: Record<number, string> = {
        5: `Khách hàng vừa đánh giá câu trả lời của bạn 5 sao — hoàn hảo, tuyệt vời.
Hãy phản hồi với sự vui mừng chân thành, cảm ơn họ, và hỏi nhẹ nhàng xem bạn có thể giúp gì thêm không.
Dùng 1-2 câu ngắn, thân thiện, dùng icon nhẹ nhàng (ví dụ: ✨ 🌸).`,

        4: `Khách hàng vừa đánh giá câu trả lời của bạn 4 sao — tốt nhưng cần cải thiện.
Hãy cảm ơn họ chân thành, thừa nhận rằng bạn sẽ cố gắng hơn, và hỏi xem còn điều gì chưa ổn để bạn hỗ trợ tốt hơn.
Dùng 2-3 câu, giọng nhẹ nhàng, cầu thị, dùng icon gần gũi (ví dụ: 🙏 😊).`,

        3: `Khách hàng vừa đánh giá câu trả lời của bạn 3 sao — tạm được, không xuất sắc.
Hãy thừa nhận điều đó một cách khiêm tốn và hỏi khách muốn bạn điều chỉnh thêm điều gì.
Đừng quá xin lỗi, chỉ cần tỏ ra cởi mở, muốn cải thiện. 2-3 câu, dùng icon trung tính (😐 💬).`,

        2: `Khách hàng vừa đánh giá câu trả lời của bạn 2 sao — tệ.
Hãy xin lỗi thực sự, thừa nhận bạn chưa đáp ứng đúng nhu cầu của họ.
Đề nghị họ mô tả lại câu hỏi để bạn thử lại hoặc kết nối với hỗ trợ viên thực của L'essence.
2-3 câu, giọng thành thật, có trách nhiệm, icon phù hợp (😕 🙏).`,

        1: `Khách hàng vừa đánh giá câu trả lời của bạn 1 sao — rất tệ.
Đây là phản hồi nghiêm trọng. Hãy xin lỗi sâu sắc và chân thành nhất có thể.
Thừa nhận hoàn toàn rằng bạn đã thất bại trong việc hỗ trợ họ.
Cam kết sẽ cải thiện và đề nghị họ liên hệ trực tiếp với đội ngũ L'essence nếu cần hỗ trợ khẩn cấp.
2-4 câu, giọng nghiêm túc, có cảm xúc, icon phù hợp (😞 💔 🙏).`,
      };

      const systemPrompt = `
Bạn là Tinco - Trợ lý AI của L'essence. Bạn vừa nhận được đánh giá từ khách hàng.
${ratingContext[rating] || ratingContext[3]}

QUAN TRỌNG:
- KHÔNG đề cập đến số sao, điểm số hoặc bất kỳ con số đánh giá nào trong câu trả lời.
- KHÔNG giải thích cơ chế đánh giá.
- Phản hồi bằng tiếng Việt tự nhiên, ngắn gọn.
- Chỉ viết đúng phần phản hồi, không thêm tiêu đề hay lời dẫn.
      `.trim();

      const userPrompt = 'Phản hồi đánh giá này.';

      const streamMessages = [{ role: 'user', content: userPrompt }];
      const response = await AIService.createChatStream(streamMessages, systemPrompt);

      if (!response.body) throw new Error('No body from AI service');

      const origin = req.headers.origin || 'http://localhost:3000';
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache, no-transform',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      });

      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }

      reply.raw.end();
      return reply;
    } catch (error: any) {
      console.error('❌ [AIChatController.handleFeedback Error]:', error);
      if (!reply.sent && !reply.raw.headersSent) {
        return reply.status(500).send({ error: error.message || 'Internal Server Error' });
      }
      if (!reply.raw.writableEnded) reply.raw.end();
      return reply;
    }
  }
}
