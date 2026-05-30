import type { FastifyInstance } from 'fastify';
import { OrderController } from '../controllers/OrderController.ts';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';

async function adminOrderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireRole('ADMIN', 'SUBADMIN'));

  app.get('/orders', OrderController.getAllOrdersForAdmin);
  app.get('/:id', OrderController.getOrderByIdForAdmin);
  app.patch('/:id/status', OrderController.updateOrderStatus);
  app.patch('/:id/payment-status', OrderController.updatePaymentStatus);
  app.delete('/:id', OrderController.deleteOrder);
}

export async function orderRoutes(app: FastifyInstance) {
  // Test endpoint
  app.get('/test-simple', async (req, reply) => {
    return reply.status(200).send({
      success: true,
      message: 'Orders test endpoint works!',
      timestamp: new Date().toISOString()
    });
  });

  // User routes
  app.get('/my-orders', { preHandler: [authMiddleware] }, OrderController.getMyOrders);
  app.get('/:id', { preHandler: [authMiddleware] }, OrderController.getOrderById);

  // Admin routes — registered under /admin prefix (no conflict with /:id)
  await app.register(adminOrderRoutes, { prefix: '/admin' });
}
