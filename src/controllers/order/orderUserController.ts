import type { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Order } from '../../models/Order.ts';
import { User } from '../../models/User.ts';
import { enhanceItemsWithProductData, recalculateTotalAmount, buildDateFilter } from './orderHelpers.ts';

/**
 * GET /api/orders/my-orders
 * Lấy lịch sử mua sắm của user đang đăng nhập
 */
export async function getMyOrders(req: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Vui lòng đăng nhập để tiếp tục',
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return reply.status(404).send({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    const { startDate, endDate, status } = req.query as { startDate?: string; endDate?: string; status?: string };
    const query: any = { userId: new mongoose.Types.ObjectId(userId) };

    const dateFilter = buildDateFilter(startDate, endDate);
    if (dateFilter) query.createdAt = dateFilter;

    if (status && status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('items')
      .sort({ createdAt: -1 })
      .lean();

    for (const order of orders as any[]) {
      if (order.items) {
        await enhanceItemsWithProductData(order.items);
        order.totalAmount = recalculateTotalAmount(order.items);
      }
    }

    return reply.status(200).send({ success: true, data: orders });
  } catch (error: any) {
    return reply.status(500).send({ success: false, message: error.message });
  }
}

/**
 * GET /api/orders/:id
 */
export async function getOrderById(req: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params as { id: string };

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: 'Vui lòng đăng nhập để tiếp tục',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, message: 'Mã đơn hàng không hợp lệ' });
    }

    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate('items')
      .lean();

    if (!order) {
      return reply.status(404).send({ success: false, message: 'Không tìm thấy đơn hàng của bạn' });
    }

    const items = (order as any).items || [];
    await enhanceItemsWithProductData(items);
    (order as any).totalAmount = recalculateTotalAmount(items);

    return reply.status(200).send({ success: true, data: order });
  } catch (error: any) {
    return reply.status(500).send({ success: false, message: error.message });
  }
}