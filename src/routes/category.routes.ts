import type { FastifyInstance } from 'fastify';
import { CategoryController } from '../controllers/CategoryController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import { requireRole } from '../middleware/authMiddleware.ts';

export async function categoryRoutes(app: FastifyInstance) {
  app.get('/', CategoryController.getAll);
  app.get('/:id', CategoryController.getById);
  app.post('/', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, CategoryController.create);
  app.patch('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, CategoryController.update);
  app.delete('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, CategoryController.delete);
  app.post('/bulk-delete', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, CategoryController.bulkDelete);
}
