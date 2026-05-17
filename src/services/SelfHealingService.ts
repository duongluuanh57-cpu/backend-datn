import { redis } from '../config/redis.ts';
import mongoose from 'mongoose';
import { PostHogService } from './PostHogService.ts';

/**
 * SelfHealingService — Hệ thống tự phục hồi hạ tầng (Skill 10)
 * Tự động phát hiện và xử lý các sự cố phổ biến của DB/Redis.
 */
export class SelfHealingService {
  /**
   * Kiểm tra và dọn dẹp Redis nếu bộ nhớ quá tải
   */
  static async checkRedisHealth() {
    try {
      const info = await redis.info('memory');
      // Ví dụ: Parse bộ nhớ và nếu > 80% thì clear cache AI
      if (info.includes('used_memory_human:1G')) { // Giả lập ngưỡng 1GB
        console.warn('⚠️ Redis Memory High! Đang dọn dẹp AI Cache...');
        const keys = await redis.keys('ai_cache:*');
        if (keys.length > 0) await redis.del(...keys);
        
        PostHogService.capture('system', 'self_healing_action', {
          action: 'redis_cache_clear',
          reason: 'memory_high'
        });
      }
    } catch (err) {
      console.error('Self-healing Redis failed', err);
    }
  }

  /**
   * Kiểm tra kết nối DB và tái kết nối nếu cần
   */
  static async checkDatabaseConnection() {
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️ Database disconnected! Đang thử kết nối lại...');
      try {
        await mongoose.connect(process.env.MONGO_URI || '');
      } catch (err) {
        console.error('Tái kết nối thất bại', err);
      }
    }
  }

  /**
   * Chạy quy trình tổng quát (Có thể gọi từ QStash hàng giờ)
   */
  static async performMaintenance() {
    console.log('🛠️ Đang chạy quy trình Self-Healing định kỳ...');
    await this.checkRedisHealth();
    await this.checkDatabaseConnection();
  }
}
