import { BrandService } from './BrandService.ts';
import { ProductService } from './ProductService.ts';
import { TagService } from './TagService.ts';
import { VoucherService } from './VoucherService.ts';
import { StatsService } from './StatsService.ts';
import { TaxonomyService } from './TaxonomyService.ts';
import { UserRepository } from '../repositories/UserRepository.ts';
import { Order } from '../models/Order.ts';

export class AdminToolService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  static getDeclarations() {
    return [
      {
        name: 'get_dashboard_stats',
        description: 'Lấy thống kê dashboard tổng quan hôm nay: doanh thu, đơn hàng mới, lượt truy cập, phần trăm KPI',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_orders',
        description: 'Lấy danh sách đơn hàng (admin). Có thể lọc theo trạng thái, thanh toán, tìm kiếm, khoảng ngày',
        parameters: {
          type: 'object',
          properties: {
            page: { type: 'integer', description: 'Trang số (mặc định 1)' },
            limit: { type: 'integer', description: 'Số lượng mỗi trang (mặc định 20)' },
            status: { type: 'string', description: 'Lọc theo status: pending, processing, shipped, delivered, cancelled', enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] },
            paymentStatus: { type: 'string', description: 'Lọc theo paymentStatus: unpaid, paid, refunded', enum: ['unpaid', 'paid', 'refunded'] },
            search: { type: 'string', description: 'Tìm kiếm theo tên khách hàng hoặc email' },
            startDate: { type: 'string', description: 'Ngày bắt đầu (YYYY-MM-DD)' },
            endDate: { type: 'string', description: 'Ngày kết thúc (YYYY-MM-DD)' },
          },
        },
      },
      {
        name: 'get_order_detail',
        description: 'Lấy chi tiết một đơn hàng theo ID',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID của đơn hàng' },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_products',
        description: 'Lấy danh sách sản phẩm. Có thể lọc, tìm kiếm, phân trang',
        parameters: {
          type: 'object',
          properties: {
            page: { type: 'integer', description: 'Trang số (mặc định 1)' },
            limit: { type: 'integer', description: 'Số lượng mỗi trang (mặc định 20)' },
            search: { type: 'string', description: 'Tìm kiếm theo tên sản phẩm' },
            brand: { type: 'string', description: 'Lọc theo brand ID' },
            stock: { type: 'string', description: 'Lọc theo tồn kho: in_stock, out_of_stock, low_stock' },
            tag: { type: 'string', description: 'Lọc theo tag ID' },
            sortBy: { type: 'string', description: 'Sắp xếp: price_asc, price_desc, newest, name_asc' },
          },
        },
      },
      {
        name: 'get_product_detail',
        description: 'Lấy chi tiết một sản phẩm theo ID',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID của sản phẩm' },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_brands',
        description: 'Lấy danh sách thương hiệu. Có thể tìm kiếm, lọc theo xuất xứ, phân trang',
        parameters: {
          type: 'object',
          properties: {
            page: { type: 'integer', description: 'Trang số (mặc định 1)' },
            limit: { type: 'integer', description: 'Số lượng mỗi trang (mặc định 20)' },
            search: { type: 'string', description: 'Tìm kiếm theo tên thương hiệu' },
            origin: { type: 'string', description: 'Lọc theo xuất xứ' },
          },
        },
      },
      {
        name: 'get_brand_detail',
        description: 'Lấy chi tiết một thương hiệu theo ID',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID của thương hiệu' },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_users',
        description: 'Lấy danh sách người dùng (admin). Có thể tìm kiếm, lọc theo role, phân trang',
        parameters: {
          type: 'object',
          properties: {
            page: { type: 'integer', description: 'Trang số (mặc định 1)' },
            limit: { type: 'integer', description: 'Số lượng mỗi trang (mặc định 20)' },
            search: { type: 'string', description: 'Tìm kiếm theo username hoặc email' },
            role: { type: 'string', description: 'Lọc theo role: USER, ADMIN, SUBADMIN', enum: ['USER', 'ADMIN', 'SUBADMIN'] },
          },
        },
      },
      {
        name: 'get_user_detail',
        description: 'Lấy chi tiết một người dùng theo ID',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID của người dùng' },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_vouchers',
        description: 'Lấy danh sách tất cả mã giảm giá (vouchers)',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_voucher_detail',
        description: 'Lấy chi tiết một mã giảm giá theo ID',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID của voucher' },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_tags',
        description: 'Lấy danh sách tags. Có thể tìm kiếm, phân trang',
        parameters: {
          type: 'object',
          properties: {
            page: { type: 'integer', description: 'Trang số (mặc định 1)' },
            limit: { type: 'integer', description: 'Số lượng mỗi trang (mặc định 25)' },
            search: { type: 'string', description: 'Tìm kiếm theo tên tag' },
          },
        },
      },
      {
        name: 'list_taxonomies',
        description: 'Lấy danh sách taxonomy terms (segment, scent_group, concentration). Bắt buộc phải có type',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Loại taxonomy', enum: ['segment', 'scent_group', 'concentration'] },
            page: { type: 'integer', description: 'Trang số (mặc định 1)' },
            limit: { type: 'integer', description: 'Số lượng mỗi trang (mặc định 25)' },
            search: { type: 'string', description: 'Tìm kiếm theo tên' },
          },
          required: ['type'],
        },
      },
    ];
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
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
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

  // ── USER-FACING TOOLS ─────────────────────────────────────────────
  static getUserDeclarations() {
    return [
      {
        name: 'search_products',
        description: 'Tìm kiếm sản phẩm nước hoa — dùng khi khách hỏi về sản phẩm cụ thể, tìm theo tên, mùi hương, thương hiệu',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Từ khoá tìm kiếm (tên sản phẩm, thương hiệu, mùi hương)' },
            limit: { type: 'integer', description: 'Số lượng kết quả tối đa (mặc định 5)' },
          },
        },
      },
      {
        name: 'get_store_overview',
        description: 'Lấy tổng quan cửa hàng: thương hiệu, nhóm hương, nồng độ, phân khúc, số lượng sản phẩm — dùng khi khách hỏi tổng quát',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }
}
