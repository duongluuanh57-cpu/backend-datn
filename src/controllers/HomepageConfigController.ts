import mongoose from 'mongoose';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { HomepageConfig } from '../models/HomepageConfig.ts';
import { redis } from '../config/redis.ts';

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
