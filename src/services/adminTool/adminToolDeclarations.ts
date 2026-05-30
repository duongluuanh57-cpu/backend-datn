/**
 * Tool declarations for Gemini AI function calling
 * Static declarations chỉ định nghĩa schema, không có logic
 */

export function getDeclarations() {
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

/**
 * User-facing tool declarations (cho khách hàng)
 */
export function getUserDeclarations() {
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