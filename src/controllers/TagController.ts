import type { FastifyRequest, FastifyReply } from 'fastify';
import { TagService } from '../services/TagService.ts';

export class TagController {
  /**
   * GET /api/tags
   */
  static async getAllTags(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const tags = await TagService.getAllTags(tenantId);
      
      return reply.status(200).send({
        success: true,
        data: tags,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/tags/:id
   */
  static async getTagById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      
      const tag = await TagService.getTagById(id, tenantId);
      if (!tag) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy tag này',
        });
      }
      
      return reply.status(200).send({
        success: true,
        data: tag,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/tags
   */
  static async createTag(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const tagData = req.body as any;
      
      const tag = await TagService.createTag(tagData, tenantId);
      
      return reply.status(201).send({
        success: true,
        data: tag,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * PATCH /api/tags/:id
   */
  static async updateTag(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const tagData = req.body as any;
      
      const tag = await TagService.updateTag(id, tagData, tenantId);
      if (!tag) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy tag để cập nhật',
        });
      }
      
      return reply.status(200).send({
        success: true,
        data: tag,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * DELETE /api/tags/:id
   */
  static async deleteTag(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      
      const success = await TagService.deleteTag(id, tenantId);
      if (!success) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy tag để xóa',
        });
      }
      
      return reply.status(200).send({
        success: true,
        message: 'Đã xóa tag thành công',
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }
}
