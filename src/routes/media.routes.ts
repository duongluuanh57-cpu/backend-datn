import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { MediaController } from '../controllers/MediaController.ts';
import { MediaLibraryController } from '../controllers/media/mediaLibraryController.ts';

export async function mediaRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: {
      fileSize: 12 * 1024 * 1024 // 12 MB (ImgBB free tier thường ~32MB; giữ vừa phải)
    }
  });

  app.post(
    '/upload-r2',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute'
        }
      }
    },
    MediaController.uploadR2
  );

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
    MediaController.uploadR2
  );

  app.delete(
    '/delete',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute'
        }
      }
    },
    MediaController.deleteR2Image
  );

  app.delete(
    '/delete-folder',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute'
        }
      }
    },
    MediaController.deleteR2Folder
  );

  app.get(
    '/',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    MediaLibraryController.listMedia
  );

  app.post(
    '/upload-url',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute'
        }
      }
    },
    MediaController.uploadUrl
  );
}
