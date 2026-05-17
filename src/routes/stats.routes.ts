import type { FastifyInstance } from 'fastify';
import { StatsService } from '../services/StatsService.ts';

/**
 * Routes cho việc lấy số liệu thống kê Dashboard
 */
export async function statsRoutes(fastify: FastifyInstance) {
  // Lấy thống kê tổng quan (Dashboard Aside)
  fastify.get('/dashboard', async (request, reply) => {
    // Trong thực tế, tenantId nên được lấy từ middleware xác thực hoặc header
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const stats = await StatsService.getDashboardStats(tenantId);
    return stats;
  });

  // API ghi nhận lượt truy cập (Gọi từ Frontend Client)
  fastify.post('/track-visit', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    await StatsService.trackVisit(tenantId);
    return { success: true };
  });
}
