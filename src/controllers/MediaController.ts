import type { FastifyRequest, FastifyReply } from 'fastify';
import { ImageService } from '../services/ImageService.ts';

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export class MediaController {
  /**
   * POST /api/media/upload-r2 — multipart: field `image` (file), optional `maxWidth`, `quality`, `folder`
   */
  static async uploadR2(req: FastifyRequest, reply: FastifyReply) {
    try {
      let fileBuffer: Buffer | null = null;
      let filename = 'upload';
      let maxWidth = 1920;
      let quality = 90;

      // Extract folder from query parameters first (e.g. ?folder=products)
      const query = req.query as { folder?: string };
      let folder = query.folder || 'image';

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
            quality = clampInt(part.value, 90, 40, 100);
          }
          if (part.fieldname === 'folder' && part.value) {
            folder = part.value as string;
          }
        }
      }

      if (!fileBuffer?.length) {
        return reply.status(400).send({
          success: false,
          message: 'Thiếu file ảnh (field multipart tên `image`).'
        });
      }

      const result = await ImageService.compressAndUpload(fileBuffer, {
        maxWidth,
        quality,
        name: filename,
        folder
      });

      return reply.status(200).send({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      return reply.status(500).send({
        success: false,
        message
      });
    }
  }

  /**
   * POST /api/media/upload-url — JSON: { url: string, maxWidth?: number, quality?: number, folder?: string }
   */
  static async uploadUrl(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { url, maxWidth = 1920, quality = 90, folder = 'image' } = req.body as {
        url: string;
        maxWidth?: number;
        quality?: number;
        folder?: string;
      };

      if (!url || typeof url !== 'string' || !url.trim()) {
        return reply.status(400).send({
          success: false,
          message: 'Đường dẫn ảnh URL không hợp lệ.'
        });
      }

      const trimmedUrl = url.trim();

      console.log(`[MediaController] Tải ảnh từ URL bên ngoài: ${trimmedUrl}`);
      
      const response = await fetch(trimmedUrl);
      if (!response.ok) {
        throw new Error(`Không thể tải ảnh từ URL: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      if (!fileBuffer.length) {
        throw new Error('Ảnh tải về bị rỗng.');
      }

      // Trích xuất tên file từ URL
      const filename = trimmedUrl.split('/').pop()?.split('?')[0] || 'downloaded-image';

      const result = await ImageService.compressAndUpload(fileBuffer, {
        maxWidth: clampInt(maxWidth, 1920, 320, 4096),
        quality: clampInt(quality, 90, 40, 100),
        name: filename,
        folder
      });

      return reply.status(200).send({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Lỗi khi xử lý tải ảnh từ URL';
      return reply.status(500).send({
        success: false,
        message
      });
    }
  }
}
