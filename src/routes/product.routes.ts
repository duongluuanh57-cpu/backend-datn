import type { FastifyInstance } from 'fastify';
import { ProductController } from '../controllers/ProductController.ts';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';

export async function productRoutes(app: FastifyInstance) {
  // Lấy danh sách sản phẩm mới (Public)
  app.get('/new', ProductController.getNewProducts);
  app.get('/sale', ProductController.getSaleProducts);
  
  // Quản lý sản phẩm (CRUD)
  app.get('/', ProductController.getAllProducts);
  app.get('/:id', ProductController.getProductById);
  
  // Tạo/Cập nhật/Xóa sản phẩm (Chỉ Admin/Subadmin)
  app.post('/', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ProductController.createProduct);
  app.patch('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ProductController.updateProduct);
  app.delete('/:id', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ProductController.deleteProduct);
  
  // Xóa hàng loạt sản phẩm
  app.post('/bulk-delete', { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] }, ProductController.bulkDeleteProducts);
}
