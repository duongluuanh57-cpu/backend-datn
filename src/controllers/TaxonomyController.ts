import type { FastifyRequest, FastifyReply } from 'fastify';
import { TaxonomyService } from '../services/TaxonomyService.ts';
import type { TaxonomySlug } from '../models/Taxonomy.ts';

const VALID_TYPES: TaxonomySlug[] = ['segment', 'scent_group', 'concentration'];

/**
 * TaxonomyController — unified controller for segments, scent_groups, concentrations
 *
 * Tất cả endpoints dùng query param `?type=segment|scent_group|concentration`
 * GET    /api/taxonomies?type=segment         — lấy tất cả theo type
 * GET    /api/taxonomies/active?type=segment  — lấy active (dùng cho dropdown)
 * GET    /api/taxonomies/:id                  — lấy 1
 * POST   /api/taxonomies                      — tạo mới (body phải có type)
 * PATCH  /api/taxonomies/:id                  — cập nhật
 * DELETE /api/taxonomies/:id                  — xóa
 */
export class TaxonomyController {
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
      const type = TaxonomyController.getType(req);
      if (!type) return reply.status(400).send({ success: false, message: `type phải là một trong: ${VALID_TYPES.join(', ')}` });
      const { page, limit, search } = req.query as { page?: string; limit?: string; search?: string };

      if (page) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
        const result = await TaxonomyService.getPaginated(type, TaxonomyController.getTenantId(req), pageNum, limitNum, search);
        return reply.send({ success: true, data: result });
      }

      const list = await TaxonomyService.getAll(type, TaxonomyController.getTenantId(req));
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** GET /api/taxonomies/active?type= */
  static async getAllActive(req: FastifyRequest, reply: FastifyReply) {
    try {
      const type = TaxonomyController.getType(req);
      if (!type) return reply.status(400).send({ success: false, message: `type phải là một trong: ${VALID_TYPES.join(', ')}` });
      const list = await TaxonomyService.getAllActive(type, TaxonomyController.getTenantId(req));
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** GET /api/taxonomies/:id */
  static async getById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const item = await TaxonomyService.getById(id, TaxonomyController.getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
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
      const item = await TaxonomyService.create(body, TaxonomyController.getTenantId(req));
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
      const item = await TaxonomyService.update(id, body, TaxonomyController.getTenantId(req));
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
      const ok = await TaxonomyService.delete(id, TaxonomyController.getTenantId(req));
      if (!ok) return reply.status(404).send({ success: false, message: 'Không tìm thấy để xóa' });
      return reply.send({ success: true, message: 'Đã xóa thành công' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }
}
