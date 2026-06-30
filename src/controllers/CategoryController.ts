import type { FastifyRequest, FastifyReply } from 'fastify';
import { CategoryService } from '../services/CategoryService.ts';

export class CategoryController {
  static async getAll(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const query = req.query as { page?: string; limit?: string; search?: string; status?: string };

      if (!query.page) {
        const categories = await CategoryService.getAll(tenantId);
        return reply.status(200).send({ success: true, data: categories });
      }

      const result = await CategoryService.getPaginatedCategories(tenantId, {
        page: parseInt(query.page, 10),
        limit: query.limit ? parseInt(query.limit, 10) : 25,
        search: query.search,
        status: query.status,
      });

      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async getById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default';
      const category = await CategoryService.getById(id, tenantId);
      if (!category) return reply.status(404).send({ success: false, message: 'Không tìm thấy category' });
      return reply.status(200).send({ success: true, data: category });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const body = req.body as { name: string; status?: string; sortOrder?: number };
      if (!body.name?.trim()) {
        return reply.status(400).send({ success: false, message: 'Tên category không được để trống' });
      }
      const category = await CategoryService.create(body, tenantId);
      return reply.status(201).send({ success: true, data: category });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async update(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default';
      const body = req.body as { name?: string; status?: string; sortOrder?: number };
      const category = await CategoryService.update(id, body, tenantId);
      if (!category) return reply.status(404).send({ success: false, message: 'Không tìm thấy category' });
      return reply.status(200).send({ success: true, data: category });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async delete(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default';
      const success = await CategoryService.delete(id, tenantId);
      if (!success) return reply.status(404).send({ success: false, message: 'Không tìm thấy category' });
      return reply.status(200).send({ success: true, message: 'Đã xoá category' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async bulkDelete(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ success: false, message: 'Danh sách ID không hợp lệ' });
      }
      const tenantId = (req as any).user?.tenantId || 'default';
      const success = await CategoryService.bulkDelete(ids, tenantId);
      if (!success) {
        return reply.status(404).send({ success: false, message: 'Không thể xóa các danh mục' });
      }
      return reply.status(200).send({ success: true, message: `Đã xóa thành công ${ids.length} danh mục` });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }
}
