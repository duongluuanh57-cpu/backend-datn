import { PostHogService } from './PostHogService.ts';
import { runHealthChecks } from './HealthCheckService.ts';

export class FailoverService {
  private static CURRENT_REGION = process.env.REGION || 'singapore';
  private static SECONDARY_REGION_URL = process.env.SECONDARY_REGION_URL || '';

  /**
   * Kiểm tra health và kích hoạt failover nếu cần
   * Được gọi từ QStash cron (mỗi 5 phút) hoặc manual từ admin
   */
  static async monitorAndFailover() {
    const { body } = await runHealthChecks();
    const status = body.status;

    if (status === 'unhealthy') {
      console.error(`🚨 [Failover] Region ${this.CURRENT_REGION} UNHEALTHY — triggering failover`);

      PostHogService.capture('system', 'region_failover_triggered', {
        failed_region: this.CURRENT_REGION,
        secondary_region: this.SECONDARY_REGION_URL,
        status,
        checks: body.checks,
      });

      await this.triggerCloudflareFailover();
      return { action: 'failover_triggered', to: this.SECONDARY_REGION_URL };
    }

    if (status === 'degraded') {
      console.warn(`⚠️ [Failover] Region ${this.CURRENT_REGION} degraded — monitoring...`);
      PostHogService.capture('system', 'region_degraded', {
        region: this.CURRENT_REGION,
        checks: body.checks,
      });
    }

    return { action: 'healthy', region: this.CURRENT_REGION };
  }

  private static async triggerCloudflareFailover() {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const loadBalancerPoolId = process.env.CLOUDFLARE_LB_POOL_ID;

    if (token && accountId && loadBalancerPoolId) {
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/load_balancers/pools/${loadBalancerPoolId}/health`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ enabled: false }),
          }
        );
        if (res.ok) {
          console.log('✅ [Failover] Cloudflare LB pool disabled — traffic routed to secondary');
        } else {
          console.warn('⚠️ [Failover] Cloudflare API returned:', await res.text());
        }
      } catch (err) {
        console.error('❌ [Failover] Cloudflare API call failed:', err);
      }
    } else {
      console.log('ℹ️ [Failover] Cloudflare LB not configured — secondary region URL:', this.SECONDARY_REGION_URL);
    }
  }
}
