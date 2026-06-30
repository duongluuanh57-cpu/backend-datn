import type { FastifyInstance } from 'fastify';
import { PaymentController, PaymentMethodController } from '../controllers/PaymentController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

export async function paymentRoutes(app: FastifyInstance) {
  // ─── Payment Methods (public) ───
  app.get('/payment-methods', PaymentMethodController.getActive);

  // ─── Payment Methods (admin) ───
  app.get('/payment-methods/all', { preHandler: authMiddleware }, PaymentMethodController.getAll);
  app.post('/payment-methods', { preHandler: authMiddleware }, PaymentMethodController.create);
  app.patch('/payment-methods/:id', { preHandler: authMiddleware }, PaymentMethodController.update);
  app.delete('/payment-methods/:id', { preHandler: authMiddleware }, PaymentMethodController.remove);

  // ─── Payment Transactions (admin) ───
  app.get('/', { preHandler: authMiddleware }, PaymentController.getAll);
  app.get('/:id', { preHandler: authMiddleware }, PaymentController.getById);
  app.get('/order/:orderId', { preHandler: authMiddleware }, PaymentController.getByOrder);
  app.post('/', { preHandler: authMiddleware }, PaymentController.create);
  app.patch('/:id/paid', { preHandler: authMiddleware }, PaymentController.markPaid);
  app.patch('/:id/failed', { preHandler: authMiddleware }, PaymentController.markFailed);
  app.patch('/:id/refunded', { preHandler: authMiddleware }, PaymentController.markRefunded);
  app.delete('/:id', { preHandler: authMiddleware }, PaymentController.remove);
}