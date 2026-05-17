import { Order } from '../models/Order.ts';
import { redis } from '../config/redis.ts';

export class StatsService {
  /**
   * Lấy thống kê tổng quan cho Dashboard dựa trên dữ liệu thật
   */
  static async getDashboardStats(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();

    // 1. Tính doanh thu trong ngày (Tổng tiền các đơn hàng chưa bị hủy tạo trong ngày)
    const revenueResult = await Order.aggregate([
      {
        $match: {
          tenantId,
          status: { $ne: 'cancelled' },
          createdAt: { $gte: today, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);
    const revenueToday = revenueResult[0]?.total || 0;

    // 2. Đếm số đơn mới trong ngày
    const newOrdersToday = await Order.countDocuments({
      tenantId,
      createdAt: { $gte: today, $lte: now }
    });

    // 3. Lấy số lượt truy cập từ Redis
    const dateStr = now.toISOString().split('T')[0];
    const visitsKey = `visits:${dateStr}:${tenantId}`;
    const visitsToday = parseInt(await redis.get(visitsKey) || '0', 10);

    return {
      revenueToday,
      newOrdersToday,
      visitsToday,
      // Tính % cho biểu đồ tròn (So với KPI ngày - demo)
      revenuePercent: Math.min(Math.round((revenueToday / 5000000) * 100), 100), // KPI: 5,000,000đ
      ordersPercent: Math.min(Math.round((newOrdersToday / 15) * 100), 100), // KPI: 15 đơn
      visitsPercent: Math.min(Math.round((visitsToday / 1000) * 100), 100), // KPI: 1000 lượt
    };
  }

  /**
   * Tăng lượt truy cập cho tenant
   */
  static async trackVisit(tenantId: string) {
    const dateStr = new Date().toISOString().split('T')[0];
    const visitsKey = `visits:${dateStr}:${tenantId}`;
    try {
      await redis.incr(visitsKey);
      await redis.expire(visitsKey, 172800); // 48 giờ
    } catch (error) {
      console.error('Error tracking visit:', error);
    }
  }
}
