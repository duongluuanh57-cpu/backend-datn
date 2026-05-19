import type { FastifyRequest, FastifyReply } from 'fastify';
import { Order } from '../models/Order.ts';
import { OrderItem } from '../models/OrderItem.ts';
import { User } from '../models/User.ts';
import mongoose from 'mongoose';

export class OrderController {
  /**
   * GET /api/orders/my-orders
   * Lấy lịch sử mua sắm của user đang đăng nhập
   * Hỗ trợ lọc theo khoảng ngày mua (startDate & endDate)
   */
  static async getMyOrders(req: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          message: 'Vui lòng đăng nhập để tiếp tục',
        });
      }

      // Lấy thông tin user hiện tại
      const user = await User.findById(userId).lean();
      if (!user) {
        return reply.status(404).send({
          success: false,
          message: 'Người dùng không tồn tại',
        });
      }

      const tenantId = user.tenantId || 'default';

      // Kiểm tra xem user đã có đơn hàng nào chưa
      const orderCount = await Order.countDocuments({ userId: new mongoose.Types.ObjectId(userId) });

      if (orderCount === 0) {
        // Tạo 3 đơn hàng mẫu với items lưu vào order_items riêng
        const dummyOrdersData = [
          {
            tenantId,
            userId: new mongoose.Types.ObjectId(userId),
            customerName: user.fullName || user.username,
            customerEmail: user.email,
            customerPhone: (user as any).phoneNumber || '0987654321',
            totalAmount: 2450000,
            status: 'delivered' as const,
            createdAt: new Date('2026-04-12T14:30:00.000Z'),
            items: [
              {
                productId: new mongoose.Types.ObjectId(),
                name: "Nước hoa L'essence Royal Amber - 100ml",
                quantity: 1,
                price: 2450000,
                image: 'https://i.ibb.co/C3Y4Vv7Y/perfume2.webp',
              },
            ],
          },
          {
            tenantId,
            userId: new mongoose.Types.ObjectId(userId),
            customerName: user.fullName || user.username,
            customerEmail: user.email,
            customerPhone: (user as any).phoneNumber || '0987654321',
            totalAmount: 1890000,
            status: 'delivered' as const,
            createdAt: new Date('2026-03-01T09:15:00.000Z'),
            items: [
              {
                productId: new mongoose.Types.ObjectId(),
                name: 'Midnight Rose Gold - 50ml',
                quantity: 1,
                price: 1890000,
                image: 'https://i.ibb.co/qFf0N0kH/perfume1.webp',
              },
            ],
          },
          {
            tenantId,
            userId: new mongoose.Types.ObjectId(userId),
            customerName: user.fullName || user.username,
            customerEmail: user.email,
            customerPhone: (user as any).phoneNumber || '0987654321',
            totalAmount: 3120000,
            status: 'delivered' as const,
            createdAt: new Date('2026-01-15T16:45:00.000Z'),
            items: [
              {
                productId: new mongoose.Types.ObjectId(),
                name: 'Imperial Leather & Suede - 100ml',
                quantity: 1,
                price: 3120000,
                image: 'https://i.ibb.co/VWV0pP0p/perfume3.webp',
              },
            ],
          },
        ];

        for (const orderData of dummyOrdersData) {
          const { items: embeddedItems, ...orderFields } = orderData;

          // 1. Create the Order document (without items yet)
          const newOrder = await Order.create({ ...orderFields, items: [] });

          // 2. Create OrderItem documents referencing this order
          const itemDocs = embeddedItems.map((item) => ({
            tenantId,
            orderId: newOrder._id,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image: item.image,
          }));
          const insertedItems = await OrderItem.insertMany(itemDocs);

          // 3. Update the Order to reference the new OrderItem IDs
          await Order.updateOne(
            { _id: newOrder._id },
            { $set: { items: insertedItems.map((i) => i._id) } }
          );
        }
      }

      // Xây dựng Query lọc theo khoảng ngày mua (startDate & endDate)
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const query: any = { userId: new mongoose.Types.ObjectId(userId) };

      if (startDate || endDate) {
        const dateQuery: any = {};
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          dateQuery.$gte = start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateQuery.$lte = end;
        }
        query.createdAt = dateQuery;
      }

      // Fetch đơn hàng và populate items từ order_items collection
      const orders = await Order.find(query)
        .populate('items')
        .sort({ createdAt: -1 })
        .lean();

      return reply.status(200).send({
        success: true,
        data: orders,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/orders/:id
   * Xem chi tiết một đơn hàng cụ thể (có đầy đủ items)
   */
  static async getOrderById(req: FastifyRequest, reply: FastifyReply) {
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
        return reply.status(400).send({
          success: false,
          message: 'Mã đơn hàng không hợp lệ',
        });
      }

      // Tìm kiếm đơn hàng và populate items từ order_items
      const order = await Order.findOne({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
      })
        .populate('items')
        .lean();

      if (!order) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy đơn hàng của bạn',
        });
      }

      return reply.status(200).send({
        success: true,
        data: order,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }
}
