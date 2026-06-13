import type { FastifyRequest, FastifyReply } from 'fastify';
import { TaxonomyTermService } from '../../services/TaxonomyTermService.ts';

export class TaxonomyTermController {
  private static getTenantId(req: FastifyRequest): string {
    return (req as any).user?.tenantId || 'default-tenant';
  }

  /**
   * GET /api/v2/taxonomies/:taxonomyId/terms
   * GET /api/v2/taxonomies/:taxonomyId/terms?active=true
   * Supports pagination when ?page= is provided
   */
  static async getAll(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { taxonomyId } = req.params as { taxonomyId: string };
      const { active, page, limit, search } = req.query as { active?: string; page?: string; limit?: string; search?: string };
      const tenantId = TaxonomyTermController.getTenantId(req);

      // Paginated response
      if (page) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
        const result = await TaxonomyTermService.getPaginated(taxonomyId, tenantId, pageNum, limitNum, search);
        return reply.send({ success: true, data: result });
      }

      const list =
        active === 'true'
          ? await TaxonomyTermService.getAllActive(taxonomyId, tenantId)
          : await TaxonomyTermService.getAll(taxonomyId, tenantId);

      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** GET /api/v2/taxonomies/:taxonomyId/terms/:id */
  static async getById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const item = await TaxonomyTermService.getById(id, TaxonomyTermController.getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy term' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** POST /api/v2/taxonomies/:taxonomyId/terms */
  static async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { taxonomyId } = req.params as { taxonomyId: string };
      const body = req.body as any;

      if (!body.name?.trim()) {
        return reply.status(400).send({ success: false, message: 'name là bắt buộc' });
      }
      // Auto-generate slug nếu không có
      if (!body.slug) {
        body.slug = body.name
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      }

      const item = await TaxonomyTermService.create(
        { ...body, taxonomyId },
        TaxonomyTermController.getTenantId(req)
      );
      return reply.status(201).send({ success: true, data: item });
    } catch (err: any) {
      if (err.code === 11000) {
        return reply.status(400).send({ success: false, message: 'Slug này đã tồn tại trong taxonomy' });
      }
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** PATCH /api/v2/taxonomies/:taxonomyId/terms/:id */
  static async update(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const item = await TaxonomyTermService.update(
        id,
        body,
        TaxonomyTermController.getTenantId(req)
      );
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy để cập nhật' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** DELETE /api/v2/taxonomies/:taxonomyId/terms/:id */
  static async remove(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const ok = await TaxonomyTermService.delete(id, TaxonomyTermController.getTenantId(req));
      if (!ok) return reply.status(404).send({ success: false, message: 'Không tìm thấy để xóa' });
      return reply.send({ success: true, message: 'Đã xóa term và tất cả liên kết với sản phẩm' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** POST /api/v2/taxonomies/:taxonomyId/terms/bulk-delete */
  static async bulkRemove(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { taxonomyId } = req.params as { taxonomyId: string };
      const { ids } = req.body as { ids: string[] };
      const tenantId = TaxonomyTermController.getTenantId(req);

      if (!ids || ids.length === 0) {
        return reply.status(400).send({ success: false, message: 'Vui lòng cung cấp danh sách ID để xóa.' });
      }

      const deleted = await TaxonomyTermService.bulkDelete(taxonomyId, ids, tenantId);
      return reply.send({ success: true, data: { deletedCount: deleted }, message: `Đã xóa ${deleted} term.` });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }
}
