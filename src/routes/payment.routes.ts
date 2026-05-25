import type { FastifyInstance } from 'fastify';
import { PaymentController } from '../controllers/PaymentController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

export async function paymentRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: authMiddleware }, PaymentController.getAll);
  app.get('/:id', { preHandler: authMiddleware }, PaymentController.getById);
  app.get('/order/:orderId', { preHandler: authMiddleware }, PaymentController.getByOrder);

  app.post('/', { preHandler: authMiddleware }, PaymentController.create);

  app.patch('/:id/paid', { preHandler: authMiddleware }, PaymentController.markPaid);
  app.patch('/:id/failed', { preHandler: authMiddleware }, PaymentController.markFailed);
  app.patch('/:id/refunded', { preHandler: authMiddleware }, PaymentController.markRefunded);

  app.delete('/:id', { preHandler: authMiddleware }, PaymentController.remove);
}
