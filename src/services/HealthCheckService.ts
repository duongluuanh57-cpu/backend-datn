import mongoose from 'mongoose';
import { redis } from '../config/redis.ts';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: CheckResult;
    redis: CheckResult;
  };
}

interface CheckResult {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

/**
 * Kiểm tra kết nối MongoDB thực sự (ping command)
 */
export async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    if (mongoose.connection.readyState !== 1) {
      return { status: 'down', error: 'MongoDB chưa kết nối' };
    }
    // Gửi ping thực sự đến MongoDB để đo latency
    await mongoose.connection.db!.admin().ping();
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'down', error: err.message };
  }
}

/**
 * Kiểm tra kết nối Redis thực sự (ping command)
 */
async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await redis.ping();
    if (result !== 'PONG') return { status: 'down', error: 'Redis không phản hồi PONG' };
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'down', error: err.message };
  }
}

/**
 * Chạy tất cả health checks và trả về trạng thái tổng hợp
 * - healthy: tất cả services OK
 * - degraded: một số service có vấn đề nhưng app vẫn chạy
 * - unhealthy: các service quan trọng (DB) đều down
 */
export async function runHealthChecks(): Promise<{ httpStatus: number; body: HealthStatus }> {
  const [database, redis] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const allUp = database.status === 'up' && redis.status === 'up';
  const dbDown = database.status === 'down';

  // Nếu DB down → Unhealthy (503), nếu chỉ Redis down → Degraded (207)
  const overallStatus: HealthStatus['status'] = allUp
    ? 'healthy'
    : dbDown
      ? 'unhealthy'
      : 'degraded';

  const httpStatus = allUp ? 200 : dbDown ? 503 : 207;

  return {
    httpStatus,
    body: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
      checks: { database, redis },
    },
  };
}
