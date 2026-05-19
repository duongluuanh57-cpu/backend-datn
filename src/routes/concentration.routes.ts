import type { FastifyInstance } from 'fastify';
import { ConcentrationController } from '../controllers/ConcentrationController.ts';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';

export async function concentrationRoutes(app: FastifyInstance) {
  // Public routes
  app.get('/', ConcentrationController.getAllConcentrations);
  app.get('/:id', ConcentrationController.getConcentrationById);

  // Private routes (Admin only)
  app.post('/', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ConcentrationController.createConcentration);
  app.patch('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ConcentrationController.updateConcentration);
  app.delete('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ConcentrationController.deleteConcentration);
}
