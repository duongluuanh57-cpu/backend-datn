import type { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentService } from '../services/PaymentService.ts';

function getTenantId(req: FastifyRequest): string {
  return (req as any).user?.tenantId || 'default-tenant';
}

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  const user = (req as any).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUBADMIN')) {
    reply.status(403).send({ success: false, message: 'Bạn không có quyền thực hiện hành động này' });
    return false;
  }
  return true;
}

export class PaymentController {
  /** GET /api/payments */
  static async getAll(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;
      const list = await PaymentService.getAll(getTenantId(req));
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** GET /api/payments/:id */
  static async getById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const item = await PaymentService.getById(id, getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy thanh toán' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** GET /api/payments/order/:orderId */
  static async getByOrder(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { orderId } = req.params as { orderId: string };
      const items = await PaymentService.getByOrder(orderId, getTenantId(req));
      return reply.send({ success: true, data: items });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** POST /api/payments */
  static async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as any;
      if (!body.orderId) return reply.status(400).send({ success: false, message: 'orderId là bắt buộc' });
      if (!body.method) return reply.status(400).send({ success: false, message: 'method là bắt buộc' });
      if (!body.amount || body.amount <= 0) return reply.status(400).send({ success: false, message: 'amount phải lớn hơn 0' });

      const item = await PaymentService.create(body, getTenantId(req));
      return reply.status(201).send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** PATCH /api/payments/:id/paid */
  static async markPaid(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;
      const { id } = req.params as { id: string };
      const { transactionCode } = req.body as { transactionCode?: string };
      const item = await PaymentService.markPaid(id, transactionCode, getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy thanh toán' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** PATCH /api/payments/:id/failed */
  static async markFailed(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;
      const { id } = req.params as { id: string };
      const item = await PaymentService.markFailed(id, getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy thanh toán' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** PATCH /api/payments/:id/refunded */
  static async markRefunded(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;
      const { id } = req.params as { id: string };
      const item = await PaymentService.markRefunded(id, getTenantId(req));
      if (!item) return reply.status(404).send({ success: false, message: 'Không tìm thấy thanh toán' });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /** DELETE /api/payments/:id */
  static async remove(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;
      const { id } = req.params as { id: string };
      const ok = await PaymentService.delete(id, getTenantId(req));
      if (!ok) return reply.status(404).send({ success: false, message: 'Không tìm thấy thanh toán' });
      return reply.send({ success: true, message: 'Đã xoá thanh toán' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }
}
