import type { FastifyInstance } from 'fastify';
import { OrderController } from '../controllers/OrderController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Test endpoint
  app.get('/test-simple', async (req, reply) => {
    return reply.status(200).send({
      success: true,
      message: 'Orders test endpoint works!',
      timestamp: new Date().toISOString()
    });
  });

  // User routes
  app.get('/my-orders', OrderController.getMyOrders);
  app.get('/:id', OrderController.getOrderById);

  // Admin routes
  // Note: Must list specific routes before parameterized routes to avoid conflicts
  app.get('/admin/orders', async (req, reply) => {
    try {
      const result = await OrderController.getAllOrdersForAdmin(req, reply);
      return result;
    } catch (error: any) {
      console.error('[ERROR] Admin orders error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Error fetching orders',
        error: error.message
      });
    }
  });

  app.get('/admin/:id', OrderController.getOrderByIdForAdmin);
  app.patch('/admin/:id/status', OrderController.updateOrderStatus);
  app.patch('/admin/:id/payment-status', OrderController.updatePaymentStatus);
  app.delete('/admin/:id', OrderController.deleteOrder);
}
