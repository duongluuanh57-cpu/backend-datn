import type { FastifyInstance } from 'fastify';
import { VoucherController } from '../controllers/VoucherController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

/**
 * /api/vouchers
 *
 * Public:
 *   GET   /api/vouchers                    — Lấy danh sách voucher active
 *   POST  /api/vouchers/validate           — Kiểm tra mã giảm giá
 *
 * Auth:
 *   GET   /api/vouchers                    — Admin: tất cả, User: active
 *   GET   /api/vouchers/:id                — Lấy chi tiết
 *
 * Admin:
 *   POST   /api/vouchers                   — Tạo voucher
 *   PATCH  /api/vouchers/:id               — Cập nhật voucher
 *   DELETE /api/vouchers/:id               — Xoá voucher
 */
export async function voucherRoutes(app: FastifyInstance) {
  // Public
  app.post('/validate', VoucherController.validate);

  // Auth
  app.get('/', { preHandler: authMiddleware }, VoucherController.getAll);
  app.get('/:id', { preHandler: authMiddleware }, VoucherController.getById);

  // Admin
  app.post('/', { preHandler: authMiddleware }, VoucherController.create);
  app.patch('/:id', { preHandler: authMiddleware }, VoucherController.update);
  app.delete('/:id', { preHandler: authMiddleware }, VoucherController.remove);
}