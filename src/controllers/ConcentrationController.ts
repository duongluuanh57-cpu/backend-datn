import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConcentrationService } from '../services/ConcentrationService.ts';

export class ConcentrationController {
  /**
   * GET /api/concentrations
   */
  static async getAllConcentrations(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const list = await ConcentrationService.getAllConcentrations(tenantId);
      return reply.status(200).send({ success: true, data: list });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/concentrations/:id
   */
  static async getConcentrationById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const item = await ConcentrationService.getConcentrationById(id, tenantId);
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy nồng độ này' });
      return reply.status(200).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/concentrations
   */
  static async createConcentration(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const data = req.body as any;
      const item = await ConcentrationService.createConcentration(data, tenantId);
      return reply.status(201).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/concentrations/:id
   */
  static async updateConcentration(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const data = req.body as any;
      const item = await ConcentrationService.updateConcentration(id, data, tenantId);
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy nồng độ để cập nhật' });
      return reply.status(200).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/concentrations/:id
   */
  static async deleteConcentration(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const success = await ConcentrationService.deleteConcentration(id, tenantId);
      if (!success) return reply.status(404).send({ success: false, message: 'Không tìm thấy nồng độ để xóa' });
      return reply.status(200).send({ success: true, message: 'Đã xóa nồng độ thành công' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }
}
