import type { FastifyRequest, FastifyReply } from 'fastify';
import { HomepageConfig } from '../models/HomepageConfig.ts';

export class HomepageConfigController {
  /**
   * GET /api/homepage-config
   * Lấy cấu hình trang chủ hiện tại. Nếu chưa có thì tự động tạo mới với giá trị mặc định.
   */
  static async getConfig(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';

      let config = await HomepageConfig.findOne({ tenantId });

      // Nếu chưa có config nào cho tenant này → tạo mới với defaults
      if (!config) {
        config = new HomepageConfig({ tenantId });
        await config.save();
      }

      return reply.status(200).send({
        success: true,
        data: config
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * PUT /api/homepage-config
   * Lưu toàn bộ cấu hình trang chủ (sections order, banner, gallery).
   */
  static async updateConfig(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const body = req.body as any;

      // Upsert: Nếu chưa có config thì tạo mới, nếu có thì cập nhật
      const config = await HomepageConfig.findOneAndUpdate(
        { tenantId },
        {
          $set: {
            ...(body.sections !== undefined && { sections: body.sections }),
            ...(body.bannerImages !== undefined && { bannerImages: body.bannerImages }),
            ...(body.bannerTitleVi !== undefined && { bannerTitleVi: body.bannerTitleVi }),
            ...(body.bannerSubtitleVi !== undefined && { bannerSubtitleVi: body.bannerSubtitleVi }),
            ...(body.bannerLabelVi !== undefined && { bannerLabelVi: body.bannerLabelVi }),
            ...(body.bannerTitleEn !== undefined && { bannerTitleEn: body.bannerTitleEn }),
            ...(body.bannerSubtitleEn !== undefined && { bannerSubtitleEn: body.bannerSubtitleEn }),
            ...(body.bannerLabelEn !== undefined && { bannerLabelEn: body.bannerLabelEn }),
            ...(body.galleryVi !== undefined && { galleryVi: body.galleryVi }),
            ...(body.galleryEn !== undefined && { galleryEn: body.galleryEn })
          }
        },
        { new: true, upsert: true, runValidators: true }
      );

      return reply.status(200).send({
        success: true,
        data: config,
        message: 'Đã cập nhật cấu hình trang chủ thành công!'
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message
      });
    }
  }
}
