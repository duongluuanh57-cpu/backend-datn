import type { FastifyRequest, FastifyReply } from 'fastify';
import { EmailService } from '../services/EmailService.ts';
import { SelfHealingService } from '../services/SelfHealingService.ts';
import { FailoverService } from '../services/FailoverService.ts';

/**
 * JobController — Xử lý các tác vụ bất đồng bộ được gọi từ QStash
 */
export class JobController {
  /**
   * Gửi email chào mừng sau khi đăng ký
   * POST /api/jobs/welcome-email
   */
  static async handleWelcomeEmail(request: FastifyRequest, reply: FastifyReply) {
    const { userId, email, name } = request.body as { userId: string; email: string; name: string };
    
    request.log.info(`[Job] Đang xử lý gửi email chào mừng cho user: ${userId} (${email})`);
    
    await EmailService.sendWelcomeEmail(email, name || 'Bạn');

    // Đánh dấu job đã xử lý thành công trong Redis (chống QStash retry gửi trùng)
    const messageId = (request as any).qstashMessageId;
    if (messageId) {
      await request.server.redis.set(`qstash:processed:${messageId}`, '1', 'EX', 86400); // TTL 24h
    }

    request.log.info(`[Job] ✅ Gửi email chào mừng thành công cho: ${email}`);
    return reply.send({ success: true, message: 'Welcome email sent successfully' });
  }

  /**
   * Dọn dẹp dữ liệu định kỳ (Cron Job)
   * POST /api/jobs/daily-cleanup
   */
  static async handleDailyCleanup(request: FastifyRequest, reply: FastifyReply) {
    request.log.info('[Cron Job] Đang thực hiện dọn dẹp dữ liệu định kỳ...');
    
    // Logic dọn dẹp ở đây...

    // Đánh dấu job đã xử lý xong
    const messageId = (request as any).qstashMessageId;
    if (messageId) {
      await request.server.redis.set(`qstash:processed:${messageId}`, '1', 'EX', 86400);
    }
    
    return reply.send({ success: true, message: 'Cleanup completed' });
  }

  /**
   * Self-healing định kỳ — kiểm tra Redis/DB health và phục hồi nếu cần
   * POST /api/jobs/self-heal
   */
  static async handleSelfHeal(request: FastifyRequest, reply: FastifyReply) {
    request.log.info('[Cron Job] Bắt đầu quy trình Self-Healing định kỳ...');

    await SelfHealingService.performMaintenance();

    const messageId = (request as any).qstashMessageId;
    if (messageId) {
      await request.server.redis.set(`qstash:processed:${messageId}`, '1', 'EX', 86400);
    }

    return reply.send({ success: true, message: 'Self-healing completed' });
  }

  /**
   * Failover check — kiểm tra region health
   * POST /api/jobs/failover-check
   */
  static async handleFailoverCheck(request: FastifyRequest, reply: FastifyReply) {
    request.log.info('[Cron Job] Kiểm tra failover...');

    const result = await FailoverService.monitorAndFailover();

    const messageId = (request as any).qstashMessageId;
    if (messageId) {
      await request.server.redis.set(`qstash:processed:${messageId}`, '1', 'EX', 86400);
    }

    return reply.send({ success: true, data: result });
  }
}
