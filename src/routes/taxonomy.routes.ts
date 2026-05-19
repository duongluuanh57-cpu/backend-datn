import type { FastifyInstance } from 'fastify';
import { TaxonomyController } from '../controllers/TaxonomyController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

/**
 * /api/taxonomies — unified route for segments, scent_groups, concentrations
 *
 * Public:
 *   GET /api/taxonomies?type=          — lấy tất cả
 *   GET /api/taxonomies/active?type=   — lấy active (dropdown)
 *   GET /api/taxonomies/:id            — lấy 1
 *
 * Protected (admin):
 *   POST   /api/taxonomies             — tạo mới
 *   PATCH  /api/taxonomies/:id         — cập nhật
 *   DELETE /api/taxonomies/:id         — xóa
 */
export async function taxonomyRoutes(app: FastifyInstance) {
  // Public read
  app.get('/', TaxonomyController.getAll);
  app.get('/active', TaxonomyController.getAllActive);
  app.get('/:id', TaxonomyController.getById);

  // Protected write
  app.post('/', { preHandler: authMiddleware }, TaxonomyController.create);
  app.patch('/:id', { preHandler: authMiddleware }, TaxonomyController.update);
  app.delete('/:id', { preHandler: authMiddleware }, TaxonomyController.remove);
}
