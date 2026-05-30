import type { FastifyRequest, FastifyReply } from 'fastify';
import { ContentSearchService } from '../../services/ContentSearchService.ts';

export class ContentController {
  static async search(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || (req.query as any)?.tenantId || 'system_core';
      const query = req.query as { q?: string; page?: string; limit?: string };

      if (!query.q?.trim()) {
        return reply.status(400).send({ success: false, message: 'Query parameter "q" is required' });
      }

      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 10;

      const result = await ContentSearchService.searchWithPagination(query.q, tenantId, page, limit);

      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }
}
