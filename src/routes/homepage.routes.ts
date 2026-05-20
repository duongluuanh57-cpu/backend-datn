import type { FastifyInstance } from 'fastify';
import { HomepageConfigController } from '../controllers/HomepageConfigController.ts';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';

export async function homepageConfigRoutes(app: FastifyInstance) {
  // GET - Endpoint công khai, trang chủ dùng để fetch config
  app.get('/', HomepageConfigController.getConfig);

  // PUT - Chỉ Admin mới được lưu cấu hình trang chủ
  app.put(
    '/',
    { preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')] },
    HomepageConfigController.updateConfig
  );
}
