import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { MediaController } from '../controllers/MediaController.ts';

export async function mediaRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: {
      fileSize: 12 * 1024 * 1024 // 12 MB (ImgBB free tier thường ~32MB; giữ vừa phải)
    }
  });

  app.post(
    '/upload-imgbb',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute'
        }
      }
    },
    MediaController.uploadImgbb
  );
}
