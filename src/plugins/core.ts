import fp from 'fastify-plugin';
import { connectDB } from '../config/database.ts';
import { connectRedis, redis } from '../config/redis.ts';
import { AuthService } from '../services/AuthService.ts';
import { AIService } from '../services/AIService.ts';
import { QStashService } from '../services/QStashService.ts';
import { PostHogService } from '../services/PostHogService.ts';
import { AgentService } from '../services/AgentService.ts';
import { ProductTaxonomyTerm } from '../models/ProductTaxonomyTerm.ts';

/**
 * Core Plugin — Đóng gói toàn bộ các service và kết nối quan trọng.
 * Sử dụng app.decorate để biến các service thành biến toàn cục trong Fastify.
 */
export default fp(async (app) => {
  // 1. Kết nối Database & Redis
  await connectDB();

  // Đồng bộ indexes với schema (drop index cũ, tạo index mới)
  try {
    await ProductTaxonomyTerm.syncIndexes();
    app.log.info('ProductTaxonomyTerm indexes synced successfully');
  } catch (err: any) {
    app.log.warn(`ProductTaxonomyTerm syncIndexes: ${err.message}`);
  }

  await connectRedis();

  // 2. Decorate app với các instance quan trọng
  app.decorate('db', { mongoose: await import('mongoose') });
  app.decorate('redis', redis);
  
  // 3. Đưa các Service vào app instance (Elite Pattern)
  app.decorate('authService', AuthService);
  app.decorate('aiService', AIService);
  app.decorate('qstashService', QStashService);
  app.decorate('postHogService', PostHogService);
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
    qstashService: typeof QStashService;
    postHogService: typeof PostHogService;
    agentService: typeof AgentService;
  }
}
