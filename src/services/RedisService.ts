import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis(REDIS_URL);
    
    this.client.on('error', (err: any) => {
      console.error('❌ [Redis Error]:', err);
    });

    this.client.on('connect', () => {
      console.log('✅ [Redis] Connected for Permanent Caching');
    });
  }

  /**
   * Lấy dữ liệu từ cache
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(`chat_cache:${key}`);
    } catch (err) {
      return null;
    }
  }

  /**
   * Lưu dữ liệu vào cache VĨNH VIỄN (Không dùng EX)
   */
  async set(key: string, value: string): Promise<void> {
    try {
      // Bỏ tham số hết hạn để lưu vĩnh viễn trong Redis
      await this.client.set(`chat_cache:${key}`, value);
    } catch (err) {
      console.error('[Redis Set Error]', err);
    }
  }

  /**
   * Tạo mã băm đơn giản cho câu hỏi
   */
  generateKey(text: string): string {
    return Buffer.from(text.trim().toLowerCase()).toString('base64').substring(0, 32);
  }
}

export const redisService = new RedisService();
