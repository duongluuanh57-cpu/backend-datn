import client from 'prom-client';

/**
 * Metrics Configuration — Thiết lập giám sát hạ tầng (Skill 11)
 */
export const register = new client.Registry();

// Thu thập các thông số mặc định của hệ thống (CPU, RAM, Event Loop)
client.collectDefaultMetrics({
  register,
  prefix: 'saas_backend_',
});

// Tạo Custom Metric: Đếm số lượng API Request
export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Tổng số lượng HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

register.registerMetric(httpRequestCounter);
