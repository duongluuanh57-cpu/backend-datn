import { FastifyRequest, FastifyReply } from 'fastify';
import { ProductImageService } from '../services/ProductImageService.ts';
import { z } from 'zod';

// Validation schemas
const addImageSchema = z.object({
  productId: z.string(),
  url: z.string().url()
});

const addMultipleImagesSchema = z.object({
  productId: z.string(),
  urls: z.array(z.string().url())
});

const getImagesSchema = z.object({
  productId: z.string()
});

const deleteImageSchema = z.object({
  imageId: z.string()
});

const updateImageSchema = z.object({
  imageId: z.string(),
  url: z.string().url()
});

export class ProductImageController {
  /**
   * GET /api/products/:productId/images
   * Lấy tất cả hình ảnh của sản phẩm
   */
  static async getProductImages(
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { productId } = request.params;
      const tenantId = (request as any).tenantId;

      const images = await ProductImageService.getProductImages(productId, tenantId);

      return reply.status(200).send({
        success: true,
        data: images,
        count: images.length
      });
    } catch (error) {
      console.error('Error getting product images:', error);
      return reply.status(500).send({
        success: false,
        message: 'Lỗi khi lấy hình ảnh sản phẩm'
      });
    }
  }

  /**
   * GET /api/products/:productId/images/primary
   * Lấy hình ảnh chính của sản phẩm
   */
  static async getPrimaryImage(
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { productId } = request.params;
      const tenantId = (request as any).tenantId;

      const image = await ProductImageService.getPrimaryImage(productId, tenantId);

      if (!image) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy hình ảnh'
        });
      }

      return reply.status(200).send({
        success: true,
        data: image
      });
    } catch (error) {
      console.error('Error getting primary image:', error);
      return reply.status(500).send({
        success: false,
        message: 'Lỗi khi lấy hình ảnh chính'
      });
    }
  }

  /**
   * POST /api/products/images
   * Thêm hình ảnh mới cho sản phẩm
   */
  static async addProductImage(
    request: FastifyRequest<{ Body: { productId: string; url: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { productId, url } = addImageSchema.parse(request.body);
      const tenantId = (request as any).tenantId;

      const image = await ProductImageService.addProductImage(productId, url, tenantId);

      return reply.status(201).send({
        success: true,
        message: 'Đã thêm hình ảnh thành công',
        data: image
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: error.errors
        });
      }
      console.error('Error adding product image:', error);
      return reply.status(500).send({
        success: false,
        message: 'Lỗi khi thêm hình ảnh'
      });
    }
  }

  /**
   * POST /api/products/images/bulk
   * Thêm nhiều hình ảnh cho sản phẩm
   */
  static async addMultipleImages(
    request: FastifyRequest<{ Body: { productId: string; urls: string[] } }>,
    reply: FastifyReply
  ) {
    try {
      const { productId, urls } = addMultipleImagesSchema.parse(request.body);
      const tenantId = (request as any).tenantId;

      const images = await ProductImageService.addMultipleImages(productId, urls, tenantId);

      return reply.status(201).send({
        success: true,
        message: `Đã thêm ${images.length} hình ảnh thành công`,
        data: images
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: error.errors
        });
      }
      console.error('Error adding multiple images:', error);
      return reply.status(500).send({
        success: false,
        message: 'Lỗi khi thêm nhiều hình ảnh'
      });
    }
  }

  /**
   * DELETE /api/products/images/:imageId
   * Xóa một hình ảnh
   */
  static async deleteProductImage(
    request: FastifyRequest<{ Params: { imageId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { imageId } = request.params;
      const tenantId = (request as any).tenantId;

      const deleted = await ProductImageService.deleteProductImage(imageId, tenantId);

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy hình ảnh'
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Đã xóa hình ảnh thành công'
      });
    } catch (error) {
      console.error('Error deleting product image:', error);
      return reply.status(500).send({
        success: false,
        message: 'Lỗi khi xóa hình ảnh'
      });
    }
  }

  /**
   * DELETE /api/products/:productId/images
   * Xóa tất cả hình ảnh của sản phẩm
   */
  static async deleteAllProductImages(
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { productId } = request.params;
      const tenantId = (request as any).tenantId;

      const count = await ProductImageService.deleteAllProductImages(productId, tenantId);

      return reply.status(200).send({
        success: true,
        message: `Đã xóa ${count} hình ảnh`,
        deletedCount: count
      });
    } catch (error) {
      console.error('Error deleting all product images:', error);
      return reply.status(500).send({
        success: false,
        message: 'Lỗi khi xóa hình ảnh'
      });
    }
  }

  /**
   * PUT /api/products/images/:imageId
   * Cập nhật URL của hình ảnh
   */
  static async updateImageUrl(
    request: FastifyRequest<{ 
      Params: { imageId: string };
      Body: { url: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { imageId } = request.params;
      const { url } = request.body;
      const tenantId = (request as any).tenantId;

      const updatedImage = await ProductImageService.updateImageUrl(imageId, url, tenantId);

      if (!updatedImage) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy hình ảnh'
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Đã cập nhật hình ảnh thành công',
        data: updatedImage
      });
    } catch (error) {
      console.error('Error updating image URL:', error);
      return reply.status(500).send({
        success: false,
        message: 'Lỗi khi cập nhật hình ảnh'
      });
    }
  }

  /**
   * GET /api/products/:productId/images/count
   * Lấy số lượng hình ảnh của sản phẩm
   */
  static async getImageCount(
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { productId } = request.params;
      const tenantId = (request as any).tenantId;

      const count = await ProductImageService.getImageCount(productId, tenantId);

      return reply.status(200).send({
        success: true,
        count
      });
    } catch (error) {
      console.error('Error getting image count:', error);
      return reply.status(500).send({
        success: false,
        message: 'Lỗi khi đếm hình ảnh'
      });
    }
  }
}
