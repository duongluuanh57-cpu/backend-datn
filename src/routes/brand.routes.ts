import type { FastifyInstance } from 'fastify';
import { BrandController } from '../controllers/BrandController.ts';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';

export async function brandRoutes(app: FastifyInstance) {
  // Đường dẫn công khai (Public)
  app.get('/', BrandController.getAllBrands);
  app.get('/origins', BrandController.getBrandOrigins);
  app.get('/:id', BrandController.getBrandById);

  // Đường dẫn bảo mật (Chỉ dành cho Admin)
  app.post('/', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, BrandController.createBrand);
  app.patch('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, BrandController.updateBrand);
  app.delete('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, BrandController.deleteBrand);
  app.post('/bulk-delete', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, BrandController.bulkDeleteBrands);
}
