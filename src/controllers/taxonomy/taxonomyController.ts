import type { FastifyRequest, FastifyReply } from 'fastify';
import { TaxonomyService } from '../../services/TaxonomyTermService.ts';
import type { TaxonomySlug } from '../../models/Taxonomy.ts';

const VALID_SLUGS: TaxonomySlug[] = ['scent_group', 'concentration', 'segment'];

export class TaxonomyController {
  private static getTenantId(req: FastifyRequest): string {
    return (req as any).user?.tenantId || 'default-tenant';
  }

  /** GET /api/v2/taxonomies */
  static async getAll(req: FastifyRequest, reply: FastifyReply) {
    try {
      const list = await TaxonomyService.getAll(TaxonomyController.getTenantId(req));
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** GET /api/v2/taxonomies/:id */
  static async getById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const item = await TaxonomyService.getById(id, TaxonomyController.getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy taxonomy' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** POST /api/v2/taxonomies */
  static async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as any;
      if (!body.slug || !VALID_SLUGS.includes(body.slug)) {
        return reply.status(400).send({
          success: false,
          message: `slug phải là một trong: ${VALID_SLUGS.join(', ')}`,
        });
      }
      if (!body.name?.trim()) {
        return reply.status(400).send({ success: false, message: 'name là bắt buộc' });
      }
      const item = await TaxonomyService.create(body, TaxonomyController.getTenantId(req));
      return reply.status(201).send({ success: true, data: item });
    } catch (err: any) {
      if (err.code === 11000) {
        return reply.status(400).send({ success: false, message: 'Taxonomy với slug này đã tồn tại' });
      }
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** PATCH /api/v2/taxonomies/:id */
  static async update(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const item = await TaxonomyService.update(id, body, TaxonomyController.getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy để cập nhật' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** DELETE /api/v2/taxonomies/:id */
  static async remove(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const ok = await TaxonomyService.delete(id, TaxonomyController.getTenantId(req));
      if (!ok) return reply.status(404).send({ success: false, message: 'Không tìm thấy để xóa' });
      return reply.send({ success: true, message: 'Đã xóa taxonomy và tất cả terms liên quan' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }
}