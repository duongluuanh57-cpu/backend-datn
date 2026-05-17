import type { FastifyRequest, FastifyReply } from 'fastify';
import { ImageService } from '../services/ImageService.ts';

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export class MediaController {
  /**
   * POST /api/media/upload-imgbb — multipart: field `image` (file), optional `maxWidth`, `quality`
   */
  static async uploadImgbb(req: FastifyRequest, reply: FastifyReply) {
    try {
      let fileBuffer: Buffer | null = null;
      let filename = 'upload';
      let maxWidth = 1920;
      let quality = 80;

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'image') {
          fileBuffer = await part.toBuffer();
          filename = part.filename || 'upload';
        } else if (part.type === 'field') {
          if (part.fieldname === 'maxWidth') {
            maxWidth = clampInt(part.value, 1920, 320, 4096);
          }
          if (part.fieldname === 'quality') {
            quality = clampInt(part.value, 80, 40, 100);
          }
        }
      }

      if (!fileBuffer?.length) {
        return reply.status(400).send({
          success: false,
          message: 'Thiếu file ảnh (field multipart tên `image`).'
        });
      }

      const result = await ImageService.compressAndUploadToImgBB(fileBuffer, {
        maxWidth,
        quality,
        name: filename
      });

      return reply.status(200).send({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      const status = message.includes('IMGBB_API_KEY') ? 503 : 500;
      return reply.status(status).send({
        success: false,
        message
      });
    }
  }
}
