import mongoose from 'mongoose';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { HomepageConfig } from '../models/HomepageConfig.ts';
import { redis } from '../config/redis.ts';

const DEFAULT_NAVBAR_LINKS = [
  { label: 'Trang chủ', href: '/', order: 0, enabled: true },
  { label: 'Cửa hàng', href: '/collections', order: 1, enabled: true },
  { label: 'Bộ sưu tập', href: '/bo-suu-tap', order: 2, enabled: true },
  { label: 'Bài viết', href: '/blog', order: 3, enabled: true },
  { label: 'Hỗ trợ', href: '/tro-giup', order: 4, enabled: true },
  { label: 'Về chúng tôi', href: '/about', order: 5, enabled: true }
];

const DEFAULT_NAVBAR_LAYOUT = {
  left: ['logo'],
  center: ['link-0', 'link-1', 'link-2', 'link-3', 'link-4', 'link-5'],
  right: ['search', 'cart', 'user']
};

export class HomepageConfigController {
  static async getConfig(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const db = mongoose.connection.db;
      if (!db) throw new Error('Database not connected');
      const col = db.collection('homepage_configs');

      let doc = await col.findOne({ tenantId });

      if (!doc) {
        await HomepageConfig.create({ tenantId });
        doc = await col.findOne({ tenantId });
      }

      if (!doc || typeof doc.productSessionLayout !== 'object') {
        await col.updateOne(
          { tenantId },
          { $set: { productSessionLayout: {} } },
          { upsert: true }
        );
        doc = await col.findOne({ tenantId });
      }

      // Merge missing navbar links into existing docs
      const existingLinks: any[] = (doc as any)?.navbar?.links || [];
      const existingLayout = (doc as any)?.navbar?.layout;
      let needsUpdate = false;

      // Add missing default links
      const existingHrefs = new Set(existingLinks.map((l: any) => l.href));
      for (const link of DEFAULT_NAVBAR_LINKS) {
        if (!existingHrefs.has(link.href)) {
          existingLinks.push(link);
          needsUpdate = true;
        }
      }

      // Add link-5 to layout center if missing
      if (
        existingLayout &&
        existingLayout.center &&
        !existingLayout.center.includes('link-5')
      ) {
        existingLayout.center.push('link-5');
        needsUpdate = true;
      }

      if (needsUpdate) {
        await col.updateOne(
          { tenantId },
          { $set: { 'navbar.links': existingLinks, 'navbar.layout': existingLayout } }
        );
        doc = await col.findOne({ tenantId });
      }

      return reply.status(200).send({ success: true, data: doc });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message
      });
    }
  }

  static async updateConfig(req: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const body = req.body as any;
      const db = mongoose.connection.db;
      if (!db) throw new Error('Database not connected');
      const col = db.collection('homepage_configs');

      // Native driver — write tất cả fields
      const fields = [
        'sections', 'bannerImages',
        'bannerTitleVi', 'bannerSubtitleVi', 'bannerLabelVi',
        'bannerTitleEn', 'bannerSubtitleEn', 'bannerLabelEn',
        'galleryVi', 'galleryEn', 'productCardConfig', 'blogCardConfig',
        'productSessionLayout', 'navbar', 'footer'
      ];
      const $set: Record<string, any> = {};
      for (const key of fields) {
        if (body[key] !== undefined) {
          $set[key] = JSON.parse(JSON.stringify(body[key]));
        }
      }

      // Clear Redis cache for public products when session layout changes
      if (body.productSessionLayout) {
        try {
          const keys = await redis.keys(`products:public:*:${tenantId}:*`);
          if (keys.length > 0) await redis.del(...keys);
        } catch (_) {}
      }

      const writeResult = await col.updateOne(
        { tenantId },
        { $set },
        { upsert: true, writeConcern: { w: 'majority' } }
      );

      const doc = await col.findOne({ tenantId });

      (doc as any)._debug = {
        receivedCD: body.productSessionLayout?.columnsDesktop,
        savedCD: doc?.productSessionLayout?.columnsDesktop,
        matched: writeResult.matchedCount,
        modified: writeResult.modifiedCount,
        writeKeys: Object.keys($set)
      };

      return reply.status(200).send({
        success: true,
        data: doc
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message
      });
    }
  }
}
