import type { FastifyRequest, FastifyReply } from 'fastify';
import { ProductService } from '../../services/ProductService.ts';

export class ProductListingController {
  /**
   * GET /api/products/new
   */
  static async getNewProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const products = await ProductService.getNewProducts(tenantId);
      return reply.status(200).send({ success: true, data: products });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/products/limited
   */
  static async getLimitedProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const products = await ProductService.getLimitedProducts(tenantId);
      return reply.status(200).send({ success: true, data: products });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/products/trending
   */
  static async getTrendingProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const products = await ProductService.getTrendingProducts(tenantId);
      return reply.status(200).send({ success: true, data: products });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/products/public?type=trending|new|limited&brand=&capacity=&priceRange=&scentGroup=&concentration=&segment=&sortBy=newest&limit=20
   */
  static async getPublicProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const query = req.query as {
        type?: string;
        brand?: string;
        capacity?: string;
        priceRange?: string;
        scentGroup?: string;
        concentration?: string;
        segment?: string;
        sortBy?: string;
        limit?: string;
        filterTag?: string;
      };

      const type = query.type as 'trending' | 'new' | 'limited';
      if (!type || !['trending', 'new', 'limited'].includes(type)) {
        return reply.status(400).send({ success: false, message: 'Invalid type. Must be trending, new, or limited.' });
      }

      const products = await ProductService.getPublicProducts(tenantId, type, {
        brand: query.brand,
        capacity: query.capacity,
        priceRange: query.priceRange,
        scentGroup: query.scentGroup,
        concentration: query.concentration,
        segment: query.segment,
        sortBy: query.sortBy || 'newest',
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        filterTag: query.filterTag,
      });

      return reply.status(200).send({ success: true, data: products });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/products/sale
   */
  static async getSaleProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const products = await ProductService.getSaleProducts(tenantId);
      return reply.status(200).send({ success: true, data: products });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/products
   * Query params: page, limit, search, brand, stock, tag, sortBy
   */
  static async getAllProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const query = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        brand?: string;
        stock?: string;
        tag?: string;
        category?: string;
        sortBy?: string;
      };

      const result = await ProductService.getAllProducts(tenantId, {
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 25,
        search: query.search,
        brand: query.brand,
        stock: query.stock,
        tag: query.tag,
        category: query.category,
        sortBy: query.sortBy,
      });

      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/products/suggest?q=...&limit=8
   */
  static async suggestProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const { q, limit } = req.query as { q?: string; limit?: string };
      if (!q || !q.trim()) {
        return reply.status(200).send({ success: true, data: [] });
      }
      const products = await ProductService.suggestProducts(
        tenantId,
        q.trim(),
        limit ? Math.min(parseInt(limit, 10), 20) : 8
      );
      return reply.status(200).send({ success: true, data: products });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/products/bulk?ids=id1,id2,id3
   */
  static async getBulkProducts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const query = req.query as { ids?: string };
      if (!query.ids) {
        return reply.status(400).send({ success: false, message: 'Missing ids query parameter.' });
      }
      const ids = query.ids.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length > 20) {
        return reply.status(400).send({ success: false, message: 'Maximum 20 IDs allowed.' });
      }
      const products = await ProductService.getBulkProducts(tenantId, ids);
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
}