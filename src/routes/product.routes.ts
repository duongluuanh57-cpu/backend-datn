import type { FastifyInstance } from 'fastify';
import { ProductController } from '../controllers/ProductController.ts';

export async function productRoutes(app: FastifyInstance) {
  // Lấy danh sách sản phẩm mới (Public)
  app.get('/new', ProductController.getNewProducts);
  app.get('/sale', ProductController.getSaleProducts);
  
  // Quản lý sản phẩm (CRUD)
  app.get('/', ProductController.getAllProducts);
  app.get('/:id', ProductController.getProductById);
  app.patch('/:id', ProductController.updateProduct);
  app.delete('/:id', ProductController.deleteProduct);
  
  // Tạo sản phẩm
  app.post('/', ProductController.createProduct);
}
