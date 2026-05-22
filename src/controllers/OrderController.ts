import type { FastifyRequest, FastifyReply } from 'fastify';
import { Order } from '../models/Order.ts';
import { OrderItem } from '../models/OrderItem.ts';
import { User } from '../models/User.ts';
import { Product } from '../models/Product.ts';
import { ProductVariant } from '../models/ProductVariant.ts';
import { ProductTaxonomyTerm } from '../models/ProductTaxonomyTerm.ts';
import mongoose from 'mongoose';

// Helper function to require admin role
function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  const user = (req as any).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUBADMIN')) {
    reply.status(403).send({
      success: false,
      message: 'Bạn không có quyền thực hiện hành động này',
    });
    return false;
  }
  return true;
}

function getTenantId(req: FastifyRequest): string {
  return (req as any).user?.tenantId || 'default';
}

export class OrderController {
  /**
   * GET /api/orders/my-orders
   * Lấy lịch sử mua sắm của user đang đăng nhập
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

      const user = await User.findById(userId).lean();
      if (!user) {
        return reply.status(404).send({
          success: false,
          message: 'Người dùng không tồn tại',
        });
      }

      const { startDate, endDate, status } = req.query as { startDate?: string; endDate?: string; status?: string };
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

      if (status && status !== 'all') {
        query.status = status;
      }

      const orders = await Order.find(query)
        .populate('items')
        .sort({ createdAt: -1 })
        .lean();

      // Enhance items with product data
      const rawIds = orders.flatMap((o: any) =>
        (o.items || []).map((i: any) => i.productId?.toString()).filter(Boolean)
      );
      const productIds = [...new Set(rawIds)].map((id) => new mongoose.Types.ObjectId(id as string));

      if (productIds.length > 0) {
        const [variants, taxonomyLinks, productData] = await Promise.all([
          ProductVariant.find({ productId: { $in: productIds } }).lean(),
          ProductTaxonomyTerm.find({ productId: { $in: productIds } })
            .populate({ path: 'termId', model: 'TaxonomyTerm', select: 'name slug' })
            .populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug name' })
            .lean(),
          Product.find(
            { _id: { $in: productIds } },
            { _id: 1, rating: 1, reviewsCount: 1, image: 1 }
          ).lean(),
        ]);

        for (const order of orders as any[]) {
          for (const item of order.items || []) {
            const pid = item.productId?.toString();
            item.variants = variants.filter((v: any) => v.productId?.toString() === pid);
            item.taxonomy = taxonomyLinks
              .filter((t: any) => t.productId?.toString() === pid)
              .map((t: any) => ({
                taxonomySlug: (t.taxonomyId as any)?.slug,
                taxonomyName: (t.taxonomyId as any)?.name,
                termName: (t.termId as any)?.name,
                termSlug: (t.termId as any)?.slug,
              }));
            const prod = productData.find((p: any) => p._id.toString() === pid);
            item.productRating = prod?.rating || 0;
            item.productReviewsCount = prod?.reviewsCount || 0;
            item.productImage = prod?.image || null;
          }
          // Tính lại totalAmount từ items
          order.totalAmount = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
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

      // Enhance items with product data
      const items = (order as any).items || [];
      const rawIds = items.map((i: any) => i.productId?.toString()).filter(Boolean);
      const productIds = [...new Set(rawIds)].map((id) => new mongoose.Types.ObjectId(id as string));

      if (productIds.length > 0) {
        const [variants, taxonomyLinks, productData] = await Promise.all([
          ProductVariant.find({ productId: { $in: productIds } }).lean(),
          ProductTaxonomyTerm.find({ productId: { $in: productIds } })
            .populate({ path: 'termId', model: 'TaxonomyTerm', select: 'name slug' })
            .populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug name' })
            .lean(),
          Product.find(
            { _id: { $in: productIds } },
            { _id: 1, rating: 1, reviewsCount: 1, image: 1 }
          ).lean(),
        ]);

        for (const item of items) {
          const pid = item.productId?.toString();
          item.variants = variants.filter((v: any) => v.productId?.toString() === pid);
          item.taxonomy = taxonomyLinks
            .filter((t: any) => t.productId?.toString() === pid)
            .map((t: any) => ({
              taxonomySlug: (t.taxonomyId as any)?.slug,
              taxonomyName: (t.taxonomyId as any)?.name,
              termName: (t.termId as any)?.name,
              termSlug: (t.termId as any)?.slug,
            }));
          const prod = productData.find((p: any) => p._id.toString() === pid);
          item.productRating = prod?.rating || 0;
          item.productReviewsCount = prod?.reviewsCount || 0;
          item.productImage = prod?.image || null;
        }
        // Tính lại totalAmount từ items
        order.totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      }

      return reply.status(200).send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/orders/admin/all
   */
  static async getAllOrdersForAdmin(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;

      const tenantId = getTenantId(req);
      const query = req.query as {
        page?: string;
        limit?: string;
        status?: string;
        paymentStatus?: string;
        search?: string;
        startDate?: string;
        endDate?: string;
      };

      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '25', 10)));
      const skip = (page - 1) * limit;

      const filter: any = { tenantId };

      if (query.status && query.status !== 'all') {
        filter.status = query.status;
      }

      if (query.paymentStatus && query.paymentStatus !== 'all') {
        filter.paymentStatus = query.paymentStatus;
      }

      if (query.search) {
        filter.$or = [
          { customerName: { $regex: query.search, $options: 'i' } },
          { customerEmail: { $regex: query.search, $options: 'i' } },
          { customerPhone: { $regex: query.search, $options: 'i' } },
        ];
      }

      if (query.startDate || query.endDate) {
        const dateQuery: any = {};
        if (query.startDate) {
          const start = new Date(query.startDate);
          start.setHours(0, 0, 0, 0);
          dateQuery.$gte = start;
        }
        if (query.endDate) {
          const end = new Date(query.endDate);
          end.setHours(23, 59, 59, 999);
          dateQuery.$lte = end;
        }
        filter.createdAt = dateQuery;
      }

      const [orders, total] = await Promise.all([
        Order.find(filter)
          .populate('items')
          .populate('userId', 'username email avatar')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Order.countDocuments(filter),
      ]);

      // Enhance items with product data
      const rawIds = orders.flatMap((o: any) =>
        (o.items || []).map((i: any) => i.productId?.toString()).filter(Boolean)
      );
      const productIds = [...new Set(rawIds)].map((id) => new mongoose.Types.ObjectId(id as string));

      if (productIds.length > 0) {
        const [variants, taxonomyLinks, productData] = await Promise.all([
          ProductVariant.find({ productId: { $in: productIds } }).lean(),
          ProductTaxonomyTerm.find({ productId: { $in: productIds } })
            .populate({ path: 'termId', model: 'TaxonomyTerm', select: 'name slug' })
            .populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug name' })
            .lean(),
          Product.find(
            { _id: { $in: productIds } },
            { _id: 1, rating: 1, reviewsCount: 1, image: 1 }
          ).lean(),
        ]);

        for (const order of orders as any[]) {
          for (const item of order.items || []) {
            const pid = item.productId?.toString();
            item.variants = variants.filter((v: any) => v.productId?.toString() === pid);
            item.taxonomy = taxonomyLinks
              .filter((t: any) => t.productId?.toString() === pid)
              .map((t: any) => ({
                taxonomySlug: (t.taxonomyId as any)?.slug,
                taxonomyName: (t.taxonomyId as any)?.name,
                termName: (t.termId as any)?.name,
                termSlug: (t.termId as any)?.slug,
              }));
            const prod = productData.find((p: any) => p._id.toString() === pid);
            item.productRating = prod?.rating || 0;
            item.productReviewsCount = prod?.reviewsCount || 0;
            item.productImage = prod?.image || null;
          }
          // Tính lại totalAmount từ items
          order.totalAmount = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
        }
      }

      return reply.status(200).send({
        success: true,
        data: {
          orders,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/orders/admin/:id
   */
  static async getOrderByIdForAdmin(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;

      const tenantId = getTenantId(req);
      const { id } = req.params as { id: string };

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return reply.status(400).send({ success: false, message: 'Mã đơn hàng không hợp lệ' });
      }

      const order = await Order.findOne({
        _id: new mongoose.Types.ObjectId(id),
        tenantId,
      })
        .populate('items')
        .populate('userId', 'username email avatar phoneNumber fullName')
        .lean();

      if (!order) {
        return reply.status(404).send({ success: false, message: 'Không tìm thấy đơn hàng' });
      }

      // Enhance items with product data
      const items = (order as any).items || [];
      const rawIds = items.map((i: any) => i.productId?.toString()).filter(Boolean);
      const productIds = [...new Set(rawIds)].map((id) => new mongoose.Types.ObjectId(id as string));

      if (productIds.length > 0) {
        const [variants, taxonomyLinks, productData] = await Promise.all([
          ProductVariant.find({ productId: { $in: productIds } }).lean(),
          ProductTaxonomyTerm.find({ productId: { $in: productIds } })
            .populate({ path: 'termId', model: 'TaxonomyTerm', select: 'name slug' })
            .populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug name' })
            .lean(),
          Product.find(
            { _id: { $in: productIds } },
            { _id: 1, rating: 1, reviewsCount: 1, image: 1 }
          ).lean(),
        ]);

        for (const item of items) {
          const pid = item.productId?.toString();
          item.variants = variants.filter((v: any) => v.productId?.toString() === pid);
          item.taxonomy = taxonomyLinks
            .filter((t: any) => t.productId?.toString() === pid)
            .map((t: any) => ({
              taxonomySlug: (t.taxonomyId as any)?.slug,
              taxonomyName: (t.taxonomyId as any)?.name,
              termName: (t.termId as any)?.name,
              termSlug: (t.termId as any)?.slug,
            }));
          const prod = productData.find((p: any) => p._id.toString() === pid);
          item.productRating = prod?.rating || 0;
          item.productReviewsCount = prod?.reviewsCount || 0;
          item.productImage = prod?.image || null;
        }
        // Tính lại totalAmount từ items
        order.totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      }

      return reply.status(200).send({ success: true, data: order });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/orders/admin/:id/status
   */
  static async updateOrderStatus(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;

      const tenantId = getTenantId(req);
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: string };

      const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ success: false, message: 'Trạng thái không hợp lệ' });
      }

      const order = await Order.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id), tenantId },
        { status },
        { new: true }
      ).lean();

      if (!order) {
        return reply.status(404).send({ success: false, message: 'Không tìm thấy đơn hàng' });
      }

      return reply.status(200).send({
        success: true,
        data: order,
        message: 'Cập nhật trạng thái đơn hàng thành công',
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/orders/admin/:id/payment-status
   */
  static async updatePaymentStatus(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;

      const tenantId = getTenantId(req);
      const { id } = req.params as { id: string };
      const { paymentStatus } = req.body as { paymentStatus: string };

      const validPaymentStatuses = ['unpaid', 'paid', 'refunded'];
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return reply.status(400).send({ success: false, message: 'Trạng thái thanh toán không hợp lệ' });
      }

      const order = await Order.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id), tenantId },
        { paymentStatus },
        { new: true }
      ).lean();

      if (!order) {
        return reply.status(404).send({ success: false, message: 'Không tìm thấy đơn hàng' });
      }

      return reply.status(200).send({
        success: true,
        data: order,
        message: 'Cập nhật trạng thái thanh toán thành công',
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/orders/admin/:id
   */
  static async deleteOrder(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!requireAdmin(req, reply)) return;

      const tenantId = getTenantId(req);
      const { id } = req.params as { id: string };

      await OrderItem.deleteMany({ orderId: new mongoose.Types.ObjectId(id), tenantId });

      const order = await Order.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(id),
        tenantId,
      });

      if (!order) {
        return reply.status(404).send({ success: false, message: 'Không tìm thấy đơn hàng' });
      }

      return reply.status(200).send({ success: true, message: 'Xóa đơn hàng thành công' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }
}