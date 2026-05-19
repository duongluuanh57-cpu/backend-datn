import type { FastifyInstance } from 'fastify';
import { ScentGroupController } from '../controllers/ScentGroupController.ts';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';

export async function scentGroupRoutes(app: FastifyInstance) {
  // Public routes
  app.get('/', ScentGroupController.getAllScentGroups);
  app.get('/:id', ScentGroupController.getScentGroupById);

  // Private routes (Admin only)
  app.post('/', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ScentGroupController.createScentGroup);
  app.patch('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ScentGroupController.updateScentGroup);
  app.delete('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ScentGroupController.deleteScentGroup);
}
