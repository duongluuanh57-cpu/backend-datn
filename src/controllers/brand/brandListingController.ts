import type { FastifyRequest, FastifyReply } from 'fastify';
import { BrandService } from '../../services/BrandService.ts';

export class BrandListingController {
  /**
   * GET /api/brands
   * Query params (optional): page, limit, search, origin
   * Không có page/limit → trả về full list (backward compatible)
   */
  static async getAllBrands(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const query = req.query as { page?: string; limit?: string; search?: string; origin?: string };

      // Backward compatible: không có page thì trả full list
      if (!query.page) {
        const brands = await BrandService.getAllBrands(tenantId);
        return reply.status(200).send({ success: true, data: brands });
      }

      const result = await BrandService.getPaginatedBrands(tenantId, {
        page: parseInt(query.page, 10),
        limit: query.limit ? parseInt(query.limit, 10) : 25,
        search: query.search,
        origin: query.origin,
      });

      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/brands/origins
   */
  static async getBrandOrigins(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const origins = await BrandService.getBrandOrigins(tenantId);

      return reply.status(200).send({
        success: true,
        data: origins,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/brands/:id
   */
  static async getBrandById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';

      const brand = await BrandService.getBrandById(id, tenantId);
      if (!brand) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy thương hiệu này',
        });
      }

      return reply.status(200).send({
        success: true,
        data: brand,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }
}