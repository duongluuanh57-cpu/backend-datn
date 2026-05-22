import type { FastifyRequest, FastifyReply } from 'fastify';
import { Order } from '../models/Order.ts';
import { OrderItem } from '../models/OrderItem.ts';
import { User } from '../models/User.ts';
import { Product } from '../models/Product.ts';
import { ProductVariant } from '../models/ProductVariant.ts';
import { ProductTaxonomyTerm } from '../models/ProductTaxonomyTerm.ts';
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

      // Xây dựng Query lọc theo khoảng ngày mua (startDate & endDate) và status
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

      // Fetch đơn hàng và populate items từ order_items collection
      const orders = await Order.find(query)
        .populate('items')
        .sort({ createdAt: -1 })
        .lean();

      // Collect tất cả productId từ items
      const rawIds = orders.flatMap((o: any) =>
        (o.items || []).map((i: any) => i.productId?.toString()).filter(Boolean)
      );
      const productIds = [...new Set(rawIds)].map((id) => new mongoose.Types.ObjectId(id as string));

      if (productIds.length > 0) {
        // Fetch variants cho từng product
        const variants = await ProductVariant.find({ productId: { $in: productIds } }).lean();

        // Fetch taxonomy cho từng product (kèm term + taxonomy name)
        const taxonomyLinks = await ProductTaxonomyTerm.find({ productId: { $in: productIds } })
          .populate({ path: 'termId', model: 'TaxonomyTerm', select: 'name slug' })
          .populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug name' })
          .lean();

        // Fetch product rating data
        const productData = await Product.find(
          { _id: { $in: productIds } },
          { _id: 1, rating: 1, reviewsCount: 1 }
        ).lean();

        // Gắn variants, taxonomy và rating vào từng item
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
          }
        }
      }

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

      // Fetch variants + taxonomy cho items
      const items = (order as any).items || [];
      const rawIds = items.map((i: any) => i.productId?.toString()).filter(Boolean);
      const productIds = [...new Set(rawIds)].map((id) => new mongoose.Types.ObjectId(id as string));

      if (productIds.length > 0) {
        const variants = await ProductVariant.find({ productId: { $in: productIds } }).lean();
        const taxonomyLinks = await ProductTaxonomyTerm.find({ productId: { $in: productIds } })
          .populate({ path: 'termId', model: 'TaxonomyTerm', select: 'name slug' })
          .populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug name' })
          .lean();

        const productData = await Product.find(
          { _id: { $in: productIds } },
          { _id: 1, rating: 1, reviewsCount: 1 }
        ).lean();

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
        }
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
