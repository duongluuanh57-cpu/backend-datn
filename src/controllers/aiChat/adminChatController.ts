import type { FastifyRequest, FastifyReply } from 'fastify';
import { QueryRouterService } from '../../services/queryRouter/QueryRouterService.ts';
import type { UserRole } from '../../services/queryRouter/queryRouterTypes.ts';

/**
 * POST /api/ai/admin/chat
 * Admin Chat — sử dụng QueryRouter với context quản trị
 * 
 * Query Router tự động:
 * - Phân loại câu hỏi (thống kê, sản phẩm, user, ...)
 * - Check role (ADMIN/SUBADMIN)
 * - Execute route phù hợp
 * - Admin query có function calling để lấy dữ liệu thật
 * 
 * Ngoại lệ: Nếu admin muốn "tạo sản phẩm cho hãng X" → trả về interview trigger
 */
export async function adminChat(req: FastifyRequest, reply: FastifyReply) {
  try {
    const body = req.body as { message: string; history?: any[] };
    const message = body.message?.trim();
    const history = body.history || [];
    const tenantId = (req as any).user?.tenantId || 'default';
    const userRole = ((req as any).user?.role || undefined) as UserRole;

    if (!message) {
      return reply.status(400).send({ error: 'Message is required' });
    }

    // ── Kiểm tra intent "tạo sản phẩm cho hãng X" ──
    const lowerMsg = message.toLowerCase();
    const createPatterns = [
      /tạo\s+(?:sản\s+phẩm\s+)?(?:cho|thương\s+hiệu|hãng|brand|của)?\s+(\S+(?:\s+\S+){0,3})/i,
      /làm\s+(?:sản\s+phẩm\s+)?(?:cho|thương\s+hiệu|hãng|brand|của)?\s+(\S+(?:\s+\S+){0,3})/i,
      /thêm\s+(?:sản\s+phẩm\s+)?(?:cho|thương\s+hiệu|hãng|brand|của)?\s+(\S+(?:\s+\S+){0,3})/i,
    ];

    for (const pattern of createPatterns) {
      const match = lowerMsg.match(pattern);
      if (match) {
        let brandName = match[1].trim();
        brandName = brandName.charAt(0).toUpperCase() + brandName.slice(1);

        // Trả về special response để frontend mở interview popup
        return reply.send({
          type: 'interview_trigger',
          brandName,
          message: `Tôi sẽ giúp bạn tạo sản phẩm cho hãng ${brandName}. Hãy làm theo các bước sau:`,
        });
      }
    }

    // ── Query Routing (cho các câu hỏi thông thường) ──
    const result = await QueryRouterService.route({
      message,
      messages: history,
      tenantId,
      userRole,
    });

    // ── Trả về kết quả ──
    if (result.type === 'direct' && result.content) {
      return reply
        .header('Content-Type', 'text/plain; charset=utf-8')
        .status(200)
        .send(result.content);
    }

    if (result.type === 'stream' && result.streamResponse) {
      const origin = req.headers.origin || 'http://localhost:3000';
      const fb = result.streamResponse;
      if (!fb.body) throw new Error('No body from AI');

      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache, no-transform',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      });

      const reader = fb.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }
      reply.raw.end();
      return reply;
    }

    // Fallback
    return reply.status(500).send({ error: 'No response generated' });

  } catch (error: any) {
    console.error('❌ [AdminChat Error]:', error);
    if (!reply.sent && !reply.raw.headersSent) {
      return reply.status(500).send({ error: error.message || 'Internal Server Error' });
    }
    if (!reply.raw.writableEnded) reply.raw.end();
    return reply;
  }
}
