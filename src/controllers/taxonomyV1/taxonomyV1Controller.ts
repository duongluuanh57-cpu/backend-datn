import type { FastifyRequest, FastifyReply } from 'fastify';
import { TaxonomyService } from '../../services/TaxonomyService.ts';
import type { TaxonomySlug } from '../../models/Taxonomy.ts';

const VALID_TYPES: TaxonomySlug[] = ['segment', 'scent_group', 'concentration'];

export class TaxonomyV1Controller {
  private static getType(req: FastifyRequest): TaxonomySlug | null {
    const { type } = (req.query as any);
    if (!type || !VALID_TYPES.includes(type)) return null;
    return type as TaxonomySlug;
  }

  private static getTenantId(req: FastifyRequest): string {
    return (req as any).user?.tenantId || 'default-tenant';
  }

  /** GET /api/taxonomies?type= — supports ?page=&limit=&search= for pagination */
  static async getAll(req: FastifyRequest, reply: FastifyReply) {
    try {
      const type = TaxonomyV1Controller.getType(req);
      if (!type) return reply.status(400).send({ success: false, message: `type phải là một trong: ${VALID_TYPES.join(', ')}` });
      const { page, limit, search } = req.query as { page?: string; limit?: string; search?: string };

      if (page) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
        const result = await TaxonomyService.getPaginated(type, TaxonomyV1Controller.getTenantId(req), pageNum, limitNum, search);
        return reply.send({ success: true, data: result });
      }

      const list = await TaxonomyService.getAll(type, TaxonomyV1Controller.getTenantId(req));
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** GET /api/taxonomies/active?type= */
  static async getAllActive(req: FastifyRequest, reply: FastifyReply) {
    try {
      const type = TaxonomyV1Controller.getType(req);
      if (!type) return reply.status(400).send({ success: false, message: `type phải là một trong: ${VALID_TYPES.join(', ')}` });
      const list = await TaxonomyService.getAllActive(type, TaxonomyV1Controller.getTenantId(req));
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** GET /api/taxonomies/:id */
  static async getById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const item = await TaxonomyService.getById(id, TaxonomyV1Controller.getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }
}