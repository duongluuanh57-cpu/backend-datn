import type { FastifyRequest, FastifyReply } from 'fastify';
import { ImageService } from '../../services/ImageService.ts';

export class MediaDeleteController {
  /**
   * DELETE /api/media/delete — JSON: { url: string }
   * Xóa ảnh khỏi Cloudflare R2
   */
  static async deleteR2Image(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { url } = req.body as { url: string };

      if (!url || typeof url !== 'string' || !url.trim()) {
        return reply.status(400).send({
          success: false,
          message: 'Thiếu URL ảnh cần xóa.'
        });
      }

      const publicDomain = process.env.R2_PUBLIC_DOMAIN || '';
      if (!url.includes(publicDomain)) {
        return reply.status(200).send({
          success: true,
          message: 'Không phải ảnh trên R2, bỏ qua xóa.'
        });
      }

      const deleted = await ImageService.deleteFromR2(url.trim());

      if (!deleted) {
        return reply.status(500).send({
          success: false,
          message: 'Không thể xóa ảnh trên Cloudflare R2.'
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Đã xóa ảnh thành công.'
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
   * DELETE /api/media/delete-folder — JSON: { urls: string[] }
   * Xóa toàn bộ thư mục (folder) chứa ảnh trên Cloudflare R2
   */
  static async deleteR2Folder(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { urls } = req.body as { urls?: string[] };

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Thiếu danh sách URL ảnh.'
        });
      }

      const publicDomain = process.env.R2_PUBLIC_DOMAIN || '';
      const r2Urls = urls.filter((u) => typeof u === 'string' && u.includes(publicDomain) && u.trim());
      if (r2Urls.length === 0) {
        return reply.status(200).send({ success: true, message: 'Không có ảnh nào trên R2 để xóa.' });
      }

      // Thử extract folder từ URL đầu tiên
      const folder = ImageService.getFolderFromUrl(r2Urls[0]);
      if (folder) {
        const deleted = await ImageService.deleteFolderFromR2(folder);
        if (deleted) {
          return reply.status(200).send({
            success: true,
            message: `Đã xóa thư mục ${folder} trên R2.`
          });
        }
      }

      // Fallback: xóa từng file nếu không extract được folder
      let successCount = 0;
      for (const url of r2Urls) {
        const ok = await ImageService.deleteFromR2(url);
        if (ok) successCount++;
      }

      return reply.status(successCount > 0 ? 200 : 500).send({
        success: successCount > 0,
        message: successCount > 0
          ? `Đã xóa ${successCount}/${r2Urls.length} ảnh trên R2.`
          : 'Không thể xóa ảnh trên Cloudflare R2.'
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      return reply.status(500).send({
        success: false,
        message
      });
    }
  }
}