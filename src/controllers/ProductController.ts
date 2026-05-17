import type { FastifyRequest, FastifyReply } from 'fastify';
import { ProductService } from '../services/ProductService.ts';

export class ProductController {
  /**
   * GET /api/products/new
   */
  static async getNewProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      // Lấy tenantId từ token (nếu có) hoặc dùng mặc định cho demo
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      
      const products = await ProductService.getNewProducts(tenantId);
      
      return reply.status(200).send({
        success: true,
        data: products,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/products/sale
   */
  static async getSaleProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const products = await ProductService.getSaleProducts(tenantId);
      
      return reply.status(200).send({
        success: true,
        data: products,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/products
   */
  static async getAllProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const products = await ProductService.getAllProducts(tenantId);
      return reply.status(200).send({ success: true, data: products });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/products/:id
   */
  static async getProductById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const product = await ProductService.getProductById(id, tenantId);
      if (!product) return reply.status(404).send({ success: false, message: 'Không tìm thấy sản phẩm' });
      return reply.status(200).send({ success: true, data: product });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/products/:id
   */
  static async updateProduct(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const product = await ProductService.updateProduct(id, req.body as any, tenantId);
      if (!product) return reply.status(404).send({ success: false, message: 'Không tìm thấy sản phẩm để cập nhật' });
      return reply.status(200).send({ success: true, data: product });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/products/:id
   */
  static async deleteProduct(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const success = await ProductService.deleteProduct(id, tenantId);
      if (!success) return reply.status(404).send({ success: false, message: 'Không tìm thấy sản phẩm để xóa' });
      return reply.status(200).send({ success: true, message: 'Đã xóa sản phẩm thành công' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/products
   */
  static async createProduct(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const productData = req.body as any;
      
      const product = await ProductService.createProduct(productData, tenantId);
      
      return reply.status(201).send({
        success: true,
        data: product,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }
}
