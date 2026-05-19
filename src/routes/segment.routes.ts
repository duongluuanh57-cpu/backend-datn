import type { FastifyInstance } from 'fastify';
import { SegmentController } from '../controllers/SegmentController.ts';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';

export async function segmentRoutes(app: FastifyInstance) {
  // Public routes
  app.get('/', SegmentController.getAllSegments);
  app.get('/:id', SegmentController.getSegmentById);

  // Private routes (Admin only)
  app.post('/', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, SegmentController.createSegment);
  app.patch('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, SegmentController.updateSegment);
  app.delete('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, SegmentController.deleteSegment);
}
