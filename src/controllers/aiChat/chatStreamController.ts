import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../../services/AIService.ts';
import { SearchService } from '../../services/SearchService.ts';
import { ContentSearchService } from '../../services/ContentSearchService.ts';
import { batchBuffer } from '../../services/BatchBufferService.ts';
import { Brand } from '../../models/Brand.ts';
import { Tag } from '../../models/Tag.ts';
import { TaxonomyTerm } from '../../models/TaxonomyTerm.ts';
import { Taxonomy } from '../../models/Taxonomy.ts';
import { Product } from '../../models/Product.ts';

/**
 * POST /api/ai/chat
 * Chat — dùng BatchBuffer để gom nhiều request vào 1 lần gọi Gemini
 * Trả về JSON { response: string }, không còn streaming real-time
 */
export async function chatStream(req: FastifyRequest, reply: FastifyReply) {
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

    // ── ADAPTIVE LEARNING ──
    const ratedMessages = messages.filter(
      (m: any) => m.role === 'assistant' && typeof m.rating === 'number'
    );
    const recentRatings = ratedMessages.slice(-5).map((m: any) => m.rating as number);
    const avgRating = recentRatings.length > 0
      ? recentRatings.reduce((a: number, b: number) => a + b, 0) / recentRatings.length
      : null;
    let consecutiveLow = 0;
    for (let i = ratedMessages.length - 1; i >= 0; i--) {
      if ((ratedMessages[i] as any).rating <= 2) consecutiveLow++;
      else break;
    }
    console.log(`📊 [Adaptive] avgRating=${avgRating?.toFixed(2) ?? 'N/A'}, consecutiveLow=${consecutiveLow}, samples=${recentRatings.length}`);

    // ── HÌNH ẢNH: fallback sang direct stream (batch không hỗ trợ vision) ──
    if (image) {
      console.log(`📸 [AIChatController] Image detected — falling back to direct stream`);
      const systemFallback = `Bạn là Tinco - Trợ lý AI bán nước hoa cao cấp. Trả lời ngắn gọn, thân thiện, dùng icon :3.`;
      const fb = await AIService.createChatStream(recentMessages, systemFallback, image);
      if (!fb.body) throw new Error('No body from AI');
      const origin = req.headers.origin || 'http://localhost:3000';
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache, no-transform',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      });
      const reader = fb.body.getReader();
      while (true) { const { done, value } = await reader.read(); if (done) break; reply.raw.write(value); }
      reply.raw.end();
      return reply;
    }

    // ── CACHE KEY ──
    const cacheKey = `ai:chat:${tenantId}:${Buffer.from(cleanQuestion).toString('base64')}`;

    // ── TRUY XUẤT TRI THỨC ──
    let products: any[] = [];
    let mode: string = '';
    let documents: any[] = [];
    try {
      const [searchResult, contentResult] = await Promise.all([
        SearchService.hybridSearch(lastMessage, tenantId, 4),
        ContentSearchService.search(lastMessage, tenantId, 3),
      ]);
      products = searchResult.products;
      mode = searchResult.mode;
      documents = contentResult;
    } catch (err) {
      console.error('❌ [Search Error]:', err);
    }

    let context = '';
    if (mode === 'confusion') {
      context = `TRẠNG THÁI: Người dùng tỏ ra bối rối/không hiểu. Hãy hỏi lại nhẹ nhàng, KIÊN NHẪN, KHÔNG đề xuất sản phẩm. Hỏi "Mình có thể giúp gì cho bạn không ạ?" hoặc "Bạn muốn tìm mùi hương như thế nào?".\n`;
    } else if (mode === 'greeting') {
      context = "TRẠNG THÁI: Khách vừa chào. Chỉ chào lại thân thiện, KHÔNG đề xuất sản phẩm.\n";
    } else if (mode === 'gibberish') {
      context = "TRẠNG THÁI: Người dùng nhập nội dung không rõ ràng. Hãy lịch sự hỏi lại họ cần tìm gì, KHÔNG đề xuất sản phẩm cụ thể.\n";
    } else if (products.length === 0) {
      context = "TRẠNG THÁI: Không tìm thấy sản phẩm phù hợp. Xin lỗi lịch sự. KHÔNG đề xuất sản phẩm.\n";
    } else {
      context = `DANH SÁCH SẢN PHẨM KHỚP NHẤT:\n${products.map(p => `- ${p.name} (Hãng: ${p.brand}): [CARD:${p._id}]`).join('\n')}\n`;
    }

    if (documents.length > 0) {
      context += `\nTÀI LIỆU LIÊN QUAN:\n${documents.map(d => `- [${d.title}]: ${d.body.substring(0, 500)}`).join('\n')}\n`;
    }

    // Build conversation history (2-3 messages gần nhất)
    const historyContext = recentMessages.slice(-3, -1).map((m: any) =>
      `[${m.role === 'user' ? 'KHÁCH' : 'TINCO'}]: ${m.content}`
    ).join('\n');
    if (historyContext) {
      context = `LỊCH SỬ HỘI THOẠI:\n${historyContext}\n\n${context}`;
    }

    let storeOverview = '';
    if (products.length > 0) {
      try {
        const [allBrands, allTags, allScents, allConcentrations, allSegments, productCount] = await Promise.all([
          Brand.find({ tenantId, status: 'active' }).select('name').lean(),
          Tag.find({ tenantId, status: 'active' }).select('name').lean(),
          Taxonomy.findOne({ slug: 'scent_group', tenantId }).lean().then(t =>
            t ? TaxonomyTerm.find({ taxonomyId: t._id, tenantId, status: 'active' }).select('name').lean() : []
          ),
          Taxonomy.findOne({ slug: 'concentration', tenantId }).lean().then(t =>
            t ? TaxonomyTerm.find({ taxonomyId: t._id, tenantId, status: 'active' }).select('name').lean() : []
          ),
          Taxonomy.findOne({ slug: 'segment', tenantId }).lean().then(t =>
            t ? TaxonomyTerm.find({ taxonomyId: t._id, tenantId, status: 'active' }).select('name').lean() : []
          ),
          Product.countDocuments({ tenantId }),
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
    }

    // ── ADAPTIVE DIRECTIVE ──
    let adaptiveDirective = '';
    if (avgRating !== null) {
      if (consecutiveLow >= 2) {
        adaptiveDirective = `HƯỚNG DẪN THÍCH ỨNG (QUAN TRỌNG): Các phản hồi gần đây không đáp ứng kỳ vọng. Hỏi lại nhu cầu chính xác hơn, dùng ngôn ngữ đơn giản, chia nhỏ thông tin, hỏi "Mình hiểu đúng ý bạn chưa? 🙏".`;
      } else if (avgRating < 3.0) {
        adaptiveDirective = `HƯỚNG DẪN THÍCH ỨNG: Hỏi thêm câu làm rõ nhu cầu, trả lời cụ thể hơn, đề xuất tối đa 2 sản phẩm. Kết thúc bằng "Bạn muốn mình tư vấn thêm không? 😊".`;
      } else if (avgRating < 4.0) {
        adaptiveDirective = `HƯỚNG DẪN THÍCH ỨNG: Thêm chi tiết cụ thể, cá nhân hóa câu trả lời.`;
      } else {
        adaptiveDirective = `HƯỚNG DẪN THÍCH ỨNG: Duy trì phong cách hiện tại — thân thiện, chính xác, hữu ích.`;
      }
    }

    // ── ĐẨY VÀO BATCH BUFFER ──
    const response = await batchBuffer.push({
      question: lastMessage,
      cleanQuestion,
      cacheKey,
      context,
      storeOverview,
      adaptiveDirective,
      tenantId,
    });

    return reply.header('Content-Type', 'text/plain; charset=utf-8').status(200).send(response);
  } catch (error: any) {
    console.error('❌ [AIChatController Error]:', error);
    return reply.status(500).send({ error: error.message || 'Internal Server Error' });
  }
}

/**
 * POST /api/ai/chat (alias)
 */
export async function supportChat(req: FastifyRequest, reply: FastifyReply) {
  return chatStream(req, reply);
}