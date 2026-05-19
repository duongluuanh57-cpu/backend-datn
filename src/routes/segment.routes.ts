/**
 * @deprecated — Legacy alias. Use /api/taxonomies?type=segment instead.
 * Kept for backward compatibility during frontend migration.
 */
import type { FastifyInstance } from 'fastify';
import { TaxonomyController } from '../controllers/TaxonomyController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

export async function segmentRoutes(app: FastifyInstance) {
  // Inject type=segment into all requests on this legacy route
  app.addHook('preHandler', async (req) => {
    (req.query as any).type = 'segment';
  });

  app.get('/', TaxonomyController.getAll);
  app.get('/:id', TaxonomyController.getById);
  app.post('/', { preHandler: authMiddleware }, TaxonomyController.create);
  app.patch('/:id', { preHandler: authMiddleware }, TaxonomyController.update);
  app.delete('/:id', { preHandler: authMiddleware }, TaxonomyController.remove);
}
