import type { FastifyRequest, FastifyReply } from 'fastify';
import { ScentGroupService } from '../services/ScentGroupService.ts';

export class ScentGroupController {
  /**
   * GET /api/scent-groups
   */
  static async getAllScentGroups(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const list = await ScentGroupService.getAllScentGroups(tenantId);
      return reply.status(200).send({ success: true, data: list });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/scent-groups/:id
   */
  static async getScentGroupById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const item = await ScentGroupService.getScentGroupById(id, tenantId);
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy nhóm hương này' });
      return reply.status(200).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/scent-groups
   */
  static async createScentGroup(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const data = req.body as any;
      const item = await ScentGroupService.createScentGroup(data, tenantId);
      return reply.status(201).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/scent-groups/:id
   */
  static async updateScentGroup(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const data = req.body as any;
      const item = await ScentGroupService.updateScentGroup(id, data, tenantId);
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy nhóm hương để cập nhật' });
      return reply.status(200).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/scent-groups/:id
   */
  static async deleteScentGroup(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const success = await ScentGroupService.deleteScentGroup(id, tenantId);
      if (!success) return reply.status(404).send({ success: false, message: 'Không tìm thấy nhóm hương để xóa' });
      return reply.status(200).send({ success: true, message: 'Đã xóa nhóm hương thành công' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }
}
