import type { FastifyRequest, FastifyReply } from 'fastify';
import { Media } from '../../models/Media.ts';

export class MediaLibraryController {
  /**
   * GET /api/media — Paginated list of uploaded images (newest first)
   */
  static async listMedia(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const query = req.query as { page?: string; limit?: string };
      const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10) || 50));
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        Media.find({ tenantId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Media.countDocuments({ tenantId }),
      ]);

      return reply.status(200).send({
        success: true,
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      return reply.status(500).send({ success: false, message });
    }
  }
}
