import type { FastifyRequest, FastifyReply } from 'fastify';
import { EmailService } from '../services/EmailService.ts';

/**
 * JobController — Xử lý các tác vụ bất đồng bộ được gọi từ QStash
 */
export class JobController {
  /**
   * Xử lý ví dụ: Gửi email chào mừng
   * POST /api/jobs/welcome-email
   */
  static async handleWelcomeEmail(request: FastifyRequest, reply: FastifyReply) {
    const { userId, email, name } = request.body as { userId: string; email: string; name: string };
    
    request.log.info(`[Job] Đang xử lý gửi email chào mừng cho user: ${userId} (${email})`);
    
    // Thực hiện gửi mail thật qua Resend
    await EmailService.sendWelcomeEmail(email, name || 'Bạn');
    
    return reply.send({ success: true, message: 'Email sent successfully via Resend' });
  }

  /**
   * Xử lý ví dụ: Tổng hợp báo cáo hàng ngày (Cron)
   * POST /api/jobs/daily-cleanup
   */
  static async handleDailyCleanup(request: FastifyRequest, reply: FastifyReply) {
    request.log.info('[Cron Job] Đang thực hiện dọn dẹp dữ liệu định kỳ...');
    
    // Logic dọn dẹp ở đây...
    
    return reply.send({ success: true, message: 'Cleanup completed' });
  }
}
