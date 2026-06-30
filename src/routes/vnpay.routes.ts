import type { FastifyInstance } from 'fastify';
import { VNPayController } from '../controllers/VNPayController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

export async function vnpayRoutes(app: FastifyInstance) {
  // POST /api/payments/vnpay-prepare — Auth: tạo PendingPayment + build URL
  app.post('/vnpay-prepare', { preHandler: authMiddleware }, VNPayController.preparePayment);

  // POST /api/payments/vnpay-ipn — Public: VNPAY gọi callback (server-to-server)
  app.post('/vnpay-ipn', VNPayController.handleIpn);

  // GET /api/payments/vnpay-ipn — Public: VNPAY cũng có thể gọi GET
  app.get('/vnpay-ipn', VNPayController.handleIpn);

  // POST /api/payments/vnpay-verify — Public: Frontend verify sau khi redirect
  app.post('/vnpay-verify', VNPayController.verifyReturn);
}