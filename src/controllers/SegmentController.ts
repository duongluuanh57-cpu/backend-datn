import type { FastifyRequest, FastifyReply } from 'fastify';
import { SegmentService } from '../services/SegmentService.ts';

export class SegmentController {
  /**
   * GET /api/segments
   */
  static async getAllSegments(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const list = await SegmentService.getAllSegments(tenantId);
      return reply.status(200).send({ success: true, data: list });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/segments/:id
   */
  static async getSegmentById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const item = await SegmentService.getSegmentById(id, tenantId);
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy phân khúc này' });
      return reply.status(200).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/segments
   */
  static async createSegment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const data = req.body as any;
      const item = await SegmentService.createSegment(data, tenantId);
      return reply.status(201).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/segments/:id
   */
  static async updateSegment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const data = req.body as any;
      const item = await SegmentService.updateSegment(id, data, tenantId);
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy phân khúc để cập nhật' });
      return reply.status(200).send({ success: true, data: item });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/segments/:id
   */
  static async deleteSegment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const success = await SegmentService.deleteSegment(id, tenantId);
      if (!success) return reply.status(404).send({ success: false, message: 'Không tìm thấy phân khúc để xóa' });
      return reply.status(200).send({ success: true, message: 'Đã xóa phân khúc thành công' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }
}
