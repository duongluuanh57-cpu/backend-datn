import type { FastifyInstance } from 'fastify';
import { TaxonomyController, TaxonomyTermController } from '../controllers/TaxonomyTermController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

/**
 * /api/v2/taxonomies — Taxonomy (cha) + TaxonomyTerm (con)
 *
 * Public:
 *   GET  /api/v2/taxonomies                              — lấy tất cả taxonomy
 *   GET  /api/v2/taxonomies/:id                          — lấy 1 taxonomy
 *   GET  /api/v2/taxonomies/:taxonomyId/terms            — lấy tất cả terms
 *   GET  /api/v2/taxonomies/:taxonomyId/terms?active=true — lấy active terms (dropdown)
 *   GET  /api/v2/taxonomies/:taxonomyId/terms/:id        — lấy 1 term
 *
 * Protected (admin):
 *   POST   /api/v2/taxonomies                            — tạo taxonomy
 *   PATCH  /api/v2/taxonomies/:id                        — cập nhật taxonomy
 *   DELETE /api/v2/taxonomies/:id                        — xóa taxonomy + tất cả terms
 *   POST   /api/v2/taxonomies/:taxonomyId/terms          — tạo term
 *   PATCH  /api/v2/taxonomies/:taxonomyId/terms/:id      — cập nhật term
 *   DELETE /api/v2/taxonomies/:taxonomyId/terms/:id      — xóa term
 */
export async function taxonomyV2Routes(app: FastifyInstance) {
  // ── Taxonomy (cha) ──────────────────────────────────────
  app.get('/', TaxonomyController.getAll);
  app.get('/:id', TaxonomyController.getById);
  app.post('/', { preHandler: authMiddleware }, TaxonomyController.create);
  app.patch('/:id', { preHandler: authMiddleware }, TaxonomyController.update);
  app.delete('/:id', { preHandler: authMiddleware }, TaxonomyController.remove);

  // ── TaxonomyTerm (con) — nested dưới /:taxonomyId/terms ─
  app.get('/:taxonomyId/terms', TaxonomyTermController.getAll);
  app.get('/:taxonomyId/terms/:id', TaxonomyTermController.getById);
  app.post('/:taxonomyId/terms', { preHandler: authMiddleware }, TaxonomyTermController.create);
  app.patch('/:taxonomyId/terms/:id', { preHandler: authMiddleware }, TaxonomyTermController.update);
  app.delete('/:taxonomyId/terms/:id', { preHandler: authMiddleware }, TaxonomyTermController.remove);
  app.post('/:taxonomyId/terms/bulk-delete', { preHandler: authMiddleware }, TaxonomyTermController.bulkRemove);
}
