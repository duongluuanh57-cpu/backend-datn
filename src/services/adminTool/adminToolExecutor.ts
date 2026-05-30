import { BrandService } from '../BrandService.ts';
import { ProductService } from '../ProductService.ts';
import { TagService } from '../TagService.ts';
import { VoucherService } from '../VoucherService.ts';
import { StatsService } from '../StatsService.ts';
import { TaxonomyService } from '../TaxonomyService.ts';
import { UserRepository } from '../../repositories/UserRepository.ts';
import { Order } from '../../models/Order.ts';

/**
 * AdminToolExecutor — chứa logic execute cho các tool admin
 */
export class AdminToolExecutor {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async execute(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case 'get_dashboard_stats':
        return await StatsService.getDashboardStats(this.tenantId);

      case 'list_orders':
        return await this.listOrders(args);

      case 'get_order_detail':
        return await this.getOrderDetail(args.id);

      case 'list_products':
        return await ProductService.getAllProducts(this.tenantId, args);

      case 'get_product_detail':
        return await ProductService.getProductById(args.id, this.tenantId);

      case 'list_brands':
        return await BrandService.getPaginatedBrands(this.tenantId, {
          page: args.page || 1,
          limit: args.limit || 20,
          search: args.search,
          origin: args.origin,
        });

      case 'get_brand_detail':
        return await BrandService.getBrandById(args.id, this.tenantId);

      case 'list_users':
        return await UserRepository.findPaginated(this.tenantId, {
          page: args.page || 1,
          limit: args.limit || 20,
          search: args.search,
          role: args.role,
        });

      case 'get_user_detail':
        return await UserRepository.findById(args.id);

      case 'list_vouchers':
        return await VoucherService.getAll(this.tenantId);

      case 'get_voucher_detail':
        return await VoucherService.getById(args.id, this.tenantId);

      case 'list_tags':
        return await TagService.getPaginatedTags(this.tenantId, args.page || 1, args.limit || 25, args.search);

      case 'list_taxonomies':
        return await TaxonomyService.getPaginated(args.type, this.tenantId, args.page || 1, args.limit || 25, args.search);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async listOrders(filters: Record<string, any>): Promise<any> {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      search,
      startDate,
      endDate,
    } = filters;

    const query: any = { tenantId: this.tenantId };

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) {
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { customerName: { $regex: '^' + esc(search), $options: 'i' } },
        { customerEmail: { $regex: '^' + esc(search), $options: 'i' } },
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(query),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  private async getOrderDetail(id: string): Promise<any> {
    const order = await Order.findOne({ _id: id, tenantId: this.tenantId }).lean();
    if (!order) throw new Error(`Order not found: ${id}`);
    return order;
  }
}