import type { FastifyInstance } from 'fastify';
import { OrderController } from '../controllers/OrderController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

export async function orderRoutes(app: FastifyInstance) {
  // Yêu cầu đăng nhập cho toàn bộ các route trong group này
  app.addHook('preHandler', authMiddleware);

  app.get('/my-orders', OrderController.getMyOrders);
  app.get('/:id', OrderController.getOrderById);
}
