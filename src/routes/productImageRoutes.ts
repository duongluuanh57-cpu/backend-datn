import { FastifyInstance } from 'fastify';
import { ProductImageController } from '../controllers/ProductImageController.ts';

export async function productImageRoutes(fastify: FastifyInstance) {
  // Lấy tất cả hình ảnh của sản phẩm
  fastify.get(
    '/products/:productId/images',
    ProductImageController.getProductImages
  );

  // Lấy hình ảnh chính của sản phẩm
  fastify.get(
    '/products/:productId/images/primary',
    ProductImageController.getPrimaryImage
  );

  // Lấy số lượng hình ảnh của sản phẩm
  fastify.get(
    '/products/:productId/images/count',
    ProductImageController.getImageCount
  );

  // Thêm hình ảnh mới cho sản phẩm
  fastify.post(
    '/products/images',
    ProductImageController.addProductImage
  );

  // Thêm nhiều hình ảnh cho sản phẩm
  fastify.post(
    '/products/images/bulk',
    ProductImageController.addMultipleImages
  );

  // Cập nhật URL của hình ảnh
  fastify.put(
    '/products/images/:imageId',
    ProductImageController.updateImageUrl
  );

  // Xóa một hình ảnh
  fastify.delete(
    '/products/images/:imageId',
    ProductImageController.deleteProductImage
  );

  // Xóa tất cả hình ảnh của sản phẩm
  fastify.delete(
    '/products/:productId/images',
    ProductImageController.deleteAllProductImages
  );
}
