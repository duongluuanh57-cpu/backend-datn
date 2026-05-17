import type { FastifyInstance } from 'fastify';
import { BrandController } from '../controllers/BrandController.ts';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';

export async function brandRoutes(app: FastifyInstance) {
  // Đường dẫn công khai (Public)
  app.get('/', BrandController.getAllBrands);
  app.get('/:id', BrandController.getBrandById);

  // Đường dẫn bảo mật (Chỉ dành cho Admin)
  app.post('/', { preHandler: [authMiddleware, requireRole('ADMIN')] }, BrandController.createBrand);
  app.patch('/:id', { preHandler: [authMiddleware, requireRole('ADMIN')] }, BrandController.updateBrand);
  app.delete('/:id', { preHandler: [authMiddleware, requireRole('ADMIN')] }, BrandController.deleteBrand);
}
