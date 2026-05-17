import { PostHog } from 'posthog-node';

/**
 * PostHogService — Quản lý Product Analytics và Feature Flags
 * Dùng để theo dõi hành vi người dùng và thử nghiệm tính năng mới.
 */
export class PostHogService {
  private static client = new PostHog(
    process.env.POSTHOG_KEY || 'phc_placeholder',
    { host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com' }
  );

  /**
   * Theo dõi một sự kiện của người dùng
   */
  static capture(distinctId: string, event: string, properties?: Record<string, any>) {
    this.client.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        $set_once: { first_seen: new Date().toISOString() },
      },
    });
  }

  /**
   * Xác định danh tính người dùng (Identify)
   */
  static identify(distinctId: string, properties: Record<string, any>) {
    this.client.identify({
      distinctId,
      properties,
    });
  }

  /**
   * Kiểm tra Feature Flag (Cờ tính năng)
   */
  static async isFeatureEnabled(flag: string, distinctId: string): Promise<boolean> {
    return await this.client.isFeatureEnabled(flag, distinctId) ?? false;
  }

  /**
   * Đóng client (Dùng khi shutdown server)
   */
  static async shutdown() {
    await this.client.shutdown();
  }
}
