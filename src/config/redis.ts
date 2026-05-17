import { Redis } from 'ioredis';

// Sử dụng chung 1 connection cho toàn bộ ứng dụng (Singleton Pattern)
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.warn('⚠️ [Redis] REDIS_URL is not defined. Redis features will be disabled.');
}

export const redis = new Redis(redisUrl || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  lazyConnect: true // Không kết nối ngay lúc khởi tạo file
});

redis.on('error', (err: any) => {
  console.error('Redis lỗi', err);
});

export async function connectRedis() {
  try {
    // Chỉ gọi connect nếu Redis đang ở trạng thái 'wait' (chưa bắt đầu kết nối)
    if (redis.status === 'wait') {
      await redis.connect();
    }
    console.log('📡 Redis: Connection established successfully');
  } catch (error) {
    if ((error as any).message !== 'Redis is already connecting/connected') {
      console.error('Kết nối đến Redis thất bại', error);
    }
  }
}
