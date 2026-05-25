import * as dotenv from 'dotenv';
dotenv.config();

import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import { authRoutes } from './routes/auth.routes.ts';
import { twoFactorRoutes } from './routes/twoFactor.routes.ts';
import { aiRoutes } from './routes/ai.routes.ts';
import { oauthRoutes } from './routes/oauth.routes.ts';
import { jobRoutes } from './routes/job.routes.ts';
import { mediaRoutes } from './routes/media.routes.ts';
import { productRoutes } from './routes/product.routes.ts';
import { userRoutes } from './routes/user.routes.ts';
import { statsRoutes } from './routes/stats.routes.ts';
import { brandRoutes } from './routes/brand.routes.ts';
import { tagRoutes } from './routes/tag.routes.ts';
import { segmentRoutes } from './routes/segment.routes.ts'; // DEPRECATED — kept for backward compat
import { orderRoutes } from './routes/order.routes.ts';
import { taxonomyRoutes } from './routes/taxonomy.routes.ts';
import { taxonomyV2Routes } from './routes/taxonomy-v2.routes.ts';
import { voucherRoutes } from './routes/voucher.routes.ts';
import { paymentRoutes } from './routes/payment.routes.ts';
// Đảm bảo các model mới được đăng ký với Mongoose khi app khởi động
import './models/Taxonomy.ts';
import './models/TaxonomyTerm.ts';
import './models/ProductTaxonomyTerm.ts';
import './models/Payment.ts';
import { userAddressRoutes } from './routes/user-address.routes.ts';
import { homepageConfigRoutes } from './routes/homepage.routes.ts';
import rawBody from 'fastify-raw-body';
import corePlugin from './plugins/core.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { runHealthChecks, checkDatabase } from './services/HealthCheckService.ts';
import { register } from './config/metrics.ts';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    bodyLimit: 10485760, // Tăng lên 10MB để nhận ảnh base64
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    }
  });

  // Đăng ký Raw Body (Dùng cho verify chữ ký QStash/Stripe)
  app.register(rawBody, {
    field: 'rawBody', 
    global: false, 
    encoding: 'utf8',
    runFirst: true,
  });

  // Đăng ký Core Plugin (Elite Pattern)
  app.register(corePlugin);

  // Đăng ký Zod Compiler (Validation ở mức Route)
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register plugins
  // 1. CORS: PHẢI ĐẶT ĐẦU TIÊN để xử lý Preflight
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
  app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  });

  // 2. Security Headers (Tắt CSP để tránh chặn local fetch)
  app.register(helmet, {
    contentSecurityPolicy: false,
  });

  app.register(compress);
  
  // TEMP: Disable rate limit for debugging
  // Rate Limiting: Dynamic (GUEST: 100/min, USER: 500/min, ADMIN: Unlimit)
  /*
  app.register(rateLimit, {
    max: (request: any) => {
      const user = (request as any).user;
      if (user?.role === 'ADMIN') return 10000; // Thực tế là không giới hạn
      if (user?.role === 'USER') return 500;
      return 100; // Guest
    },
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return (request as any).user?._id?.toString() || request.ip;
    }
  });
  */

  // Routes
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(oauthRoutes, { prefix: '/api/auth' });
  app.register(twoFactorRoutes, { prefix: '/api/2fa' });
  app.register(aiRoutes, { prefix: '/api/ai' });
  app.register(jobRoutes, { prefix: '/api/jobs' });
  app.register(mediaRoutes, { prefix: '/api/media' });
  app.register(productRoutes, { prefix: '/api/products' });
  app.register(userRoutes, { prefix: '/api/users' });
  app.register(statsRoutes, { prefix: '/api/stats' });
  app.register(brandRoutes, { prefix: '/api/brands' });
  app.register(tagRoutes, { prefix: '/api/tags' });
  // Taxonomy (segment, scent_group, concentration) — unified
  app.register(taxonomyRoutes, { prefix: '/api/taxonomies' });
  // Taxonomy v2 — Taxonomy (cha) + TaxonomyTerm (con) + bảng trung gian
  app.register(taxonomyV2Routes, { prefix: '/api/v2/taxonomies' });
  // Legacy aliases — kept for backward compat during transition
  app.register(segmentRoutes, { prefix: '/api/segments' });
  app.register(orderRoutes, { prefix: '/api/orders' });
  app.register(userAddressRoutes, { prefix: '/api/user-addresses' });
  app.register(homepageConfigRoutes, { prefix: '/api/homepage-config' });
  app.register(voucherRoutes, { prefix: '/api/vouchers' });
  app.register(paymentRoutes, { prefix: '/api/payments' });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Root route - Welcome and Health status
  app.get('/', async (request, reply) => {
    const { body } = await runHealthChecks();
    return reply.status(200).send({
      message: '🚀 Elite SaaS Backend API is running smoothly!',
      version: process.env.APP_VERSION || '1.0.0',
      systemStatus: body.status,
      timestamp: new Date().toISOString()
    });
  });

  // Health check route - Thực hiện kiểm tra thực tế kết nối DB và Redis
  app.get('/health', async (request, reply) => {
    const { httpStatus, body } = await runHealthChecks();
    return reply.status(httpStatus).send(body);
  });

  // Ping route - Trả về 200 chỉ khi MongoDB thực sự sẵn sàng xử lý query
  app.get('/ping', async (request, reply) => {
    const dbCheck = await checkDatabase();
    if (dbCheck.status !== 'up') {
      return reply.status(503).send({ status: 'warming_up', timestamp: new Date().toISOString() });
    }
    return reply.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Prometheus Metrics endpoint - Skill 11
  app.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return reply.send(await register.metrics());
  });

  return app;
}
