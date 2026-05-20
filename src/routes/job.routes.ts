import type { FastifyInstance } from 'fastify';
import { JobController } from '../controllers/JobController.ts';
import { qstashMiddleware } from '../middleware/qstashMiddleware.ts';

/**
 * Job Routes — Các endpoint nội bộ dành cho QStash gọi đến
 * Mọi route ở đây BẮT BUỘC phải qua qstashMiddleware để xác thực.
 * rawBody: true — Bắt buộc bật để qstashMiddleware verify được chữ ký Upstash
 * (vì app.ts đăng ký fastify-raw-body với global: false)
 */
export async function jobRoutes(app: FastifyInstance) {
  // Áp dụng middleware xác thực chữ ký cho toàn bộ các route trong group này
  app.addHook('preHandler', qstashMiddleware);

  app.post('/welcome-email', { config: { rawBody: true } }, JobController.handleWelcomeEmail);
  app.post('/daily-cleanup', { config: { rawBody: true } }, JobController.handleDailyCleanup);
}
