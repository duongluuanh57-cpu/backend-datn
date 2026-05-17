import type { FastifyInstance } from 'fastify';
import { JobController } from '../controllers/JobController.ts';
import { qstashMiddleware } from '../middleware/qstashMiddleware.ts';

/**
 * Job Routes — Các endpoint nội bộ dành cho QStash gọi đến
 * Mọi route ở đây BẮT BUỘC phải qua qstashMiddleware để xác thực.
 */
export async function jobRoutes(app: FastifyInstance) {
  // Áp dụng middleware xác thực chữ ký cho toàn bộ các route trong group này
  app.addHook('preHandler', qstashMiddleware);

  app.post('/welcome-email', JobController.handleWelcomeEmail);
  app.post('/daily-cleanup', JobController.handleDailyCleanup);
}
