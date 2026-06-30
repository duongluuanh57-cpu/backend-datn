import fp from 'fastify-plugin';
import { connectDB } from '../config/database.ts';
import { connectRedis, redis } from '../config/redis.ts';
import { AuthService } from '../services/AuthService.ts';
import { AIService } from '../services/AIService.ts';
import { AgentService } from '../services/AgentService.ts';

/**
 * Core Plugin — Đóng gói toàn bộ các service và kết nối quan trọng.
 * Sử dụng app.decorate để biến các service thành biến toàn cục trong Fastify.
 */
export default fp(async (app) => {
  // 1. Kết nối Database & Redis
  await connectDB();
  await connectRedis();

  // 2. Decorate app với các instance quan trọng
  app.decorate('db', { mongoose: await import('mongoose') });
  app.decorate('redis', redis);
  
  // 3. Đưa các Service vào app instance (Elite Pattern)
  app.decorate('authService', AuthService);
  app.decorate('aiService', AIService);
  app.decorate('agentService', AgentService);

  app.log.info('Elite Core Plugin: All services and AI Agents loaded successfully!');
});

// Khai báo kiểu dữ liệu cho TypeScript để có gợi ý code (IntelliSense)
declare module 'fastify' {
  interface FastifyInstance {
    db: any;
    redis: typeof redis;
    authService: typeof AuthService;
    aiService: typeof AIService;
    agentService: typeof AgentService;
  }
}
