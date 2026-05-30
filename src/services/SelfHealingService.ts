import { redis, isRedisAvailable } from '../config/redis.ts';
import mongoose from 'mongoose';
import { PostHogService } from './PostHogService.ts';

export class SelfHealingService {
  private static REDIS_MEMORY_THRESHOLD_PERCENT = 0.8;

  static async checkRedisHealth() {
    if (!isRedisAvailable()) {
      console.warn('⚠️ [SelfHeal] Redis not available, skipping memory check');
      return;
    }

    try {
      const info = await redis.info('memory');
      const usedMatch = info.match(/used_memory:(\d+)/);
      const maxMatch = info.match(/maxmemory:(\d+)/);
      const used = usedMatch ? parseInt(usedMatch[1], 10) : 0;
      const max = maxMatch ? parseInt(maxMatch[1], 10) : 0;

      if (max > 0 && used / max > this.REDIS_MEMORY_THRESHOLD_PERCENT) {
        const percent = ((used / max) * 100).toFixed(1);
        console.warn(`⚠️ [SelfHeal] Redis memory at ${percent}% — clearing AI cache`);

        let deleted = 0;
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'ai_cache:*', 'COUNT', 100);
          if (keys.length > 0) {
            await redis.del(...keys);
            deleted += keys.length;
          }
          cursor = nextCursor;
        } while (cursor !== '0');

        console.log(`✅ [SelfHeal] Cleared ${deleted} AI cache keys`);
        PostHogService.capture('system', 'self_healing_action', {
          action: 'redis_cache_clear',
          reason: 'memory_high',
          usagePercent: percent,
          deletedKeys: deleted,
        });
      }
    } catch (err) {
      console.error('❌ [SelfHeal] Redis check failed:', err);
    }
  }

  static async checkDatabaseConnection() {
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️ [SelfHeal] Database disconnected — attempting reconnect...');
      try {
        await mongoose.connect(process.env.MONGO_URI || '');
        console.log('✅ [SelfHeal] Database reconnected successfully');
      } catch (err) {
        console.error('❌ [SelfHeal] Reconnect failed:', err);
      }
    }
  }

  static clearAICache(): void {
    PostHogService.capture('system', 'self_healing_action', {
      action: 'ai_cache_clear_manual',
      reason: 'manual_trigger',
    });
  }

  static async performMaintenance() {
    console.log('🛠️ [SelfHeal] Running scheduled maintenance...');
    await this.checkRedisHealth();
    await this.checkDatabaseConnection();
    console.log('✅ [SelfHeal] Maintenance complete');
  }
}
