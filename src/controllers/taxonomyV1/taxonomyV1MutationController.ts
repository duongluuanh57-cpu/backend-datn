import type { FastifyRequest, FastifyReply } from 'fastify';
import { TaxonomyService } from '../../services/TaxonomyService.ts';
import type { TaxonomySlug } from '../../models/Taxonomy.ts';

const VALID_TYPES: TaxonomySlug[] = ['segment', 'scent_group', 'concentration'];

export class TaxonomyV1MutationController {
  private static getTenantId(req: FastifyRequest): string {
    return (req as any).user?.tenantId || 'default-tenant';
  }

  /** POST /api/taxonomies */
  static async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as any;
      if (!body.type || !VALID_TYPES.includes(body.type)) {
        return reply.status(400).send({ success: false, message: `type phải là một trong: ${VALID_TYPES.join(', ')}` });
      }
      if (!body.name?.trim()) {
        return reply.status(400).send({ success: false, message: 'name là bắt buộc' });
      }
      // Auto-generate slug if not provided
      if (!body.slug) {
        body.slug = body.name.trim().toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      }
      const item = await TaxonomyService.create(body, TaxonomyV1MutationController.getTenantId(req));
      return reply.status(201).send({ success: true, data: item });
    } catch (err: any) {
      if (err.code === 11000) {
        return reply.status(400).send({ success: false, message: 'Slug này đã tồn tại cho loại taxonomy này' });
      }
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** PATCH /api/taxonomies/:id */
  static async update(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const item = await TaxonomyService.update(id, body, TaxonomyV1MutationController.getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy để cập nhật' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** DELETE /api/taxonomies/:id */
  static async remove(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const ok = await TaxonomyService.delete(id, TaxonomyV1MutationController.getTenantId(req));
      if (!ok) return reply.status(404).send({ success: false, message: 'Không tìm thấy để xóa' });
      return reply.send({ success: true, message: 'Đã xóa thành công' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }
}