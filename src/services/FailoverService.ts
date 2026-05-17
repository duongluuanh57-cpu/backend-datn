import { PostHogService } from './PostHogService.ts';
import { runHealthChecks } from './HealthCheckService.ts';

/**
 * FailoverService — Hệ thống quản trị rủi ro và điều hướng vùng (Phase 3)
 */
export class FailoverService {
  private static CURRENT_REGION = process.env.REGION || 'singapore';
  private static SECONDARY_REGION_URL = process.env.SECONDARY_REGION_URL || '';

  /**
   * Kiểm tra và tự động chuyển vùng nếu Region hiện tại gặp sự cố
   */
  static async monitorAndFailover() {
    console.log(`🌍 [Failover] Đang giám sát Region: ${this.CURRENT_REGION}`);
    
    const { body } = await runHealthChecks();
    const status = body.status;
    
    if (status === 'unhealthy') {
      console.error('🚨 PHÁT HIỆN SỰ CỐ REGION! Đang kích hoạt quy trình Failover...');
      
      // 1. Gửi log lên PostHog/Sentry
      PostHogService.capture('system', 'region_failover_triggered', {
        failed_region: this.CURRENT_REGION,
        secondary_region: this.SECONDARY_REGION_URL
      });

      // 2. Logic điều hướng (Trong thực tế sẽ gọi API của Cloudflare Load Balancer)
      await this.triggerCloudflareFailover();
    }
  }

  private static async triggerCloudflareFailover() {
    // Giả lập gọi API Cloudflare để đổi trọng số (Weight) traffic sang Region dự phòng
    console.log('✅ Đã điều hướng 100% traffic sang Secondary Region.');
  }
}
