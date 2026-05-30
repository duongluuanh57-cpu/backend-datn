import { DocsFetcher } from './docsFetcher.ts';

export class DocsSelector {
  // ── Topic-based doc selection ─────────────────────────────────────
  // Labels luôn được gửi dù query có match keyword hay không
  private static DEFAULT_LABELS = [
    'Backend Project Structure',
    'Backend Tech Stack',
    'Backend API Reference',
    'Frontend Project Structure',
    'Frontend Tech Stack',
  ];

  // Keyword → doc labels mapping: khi query chứa keyword, các label tương ứng được thêm vào
  private static TOPIC_MAP: { keywords: string[]; labels: string[] }[] = [
    { keywords: ['order', 'đơn hàng', 'revenue', 'doanh thu', 'payment', 'thanh toán', 'stripe', 'vnpay'], labels: ['Backend Database Schema', 'Backend API Reference'] },
    { keywords: ['product', 'sản phẩm', 'inventory', 'tồn kho', 'price', 'giá'], labels: ['Backend Database Schema', 'Backend API Reference', 'Backend Coding Standards'] },
    { keywords: ['user', 'người dùng', 'customer', 'khách hàng', 'auth', 'role', 'login', 'register'], labels: ['Backend Database Schema', 'Backend API Reference', 'Backend AI Architecture'] },
    { keywords: ['brand', 'thương hiệu'], labels: ['Backend Database Schema', 'Backend API Reference'] },
    { keywords: ['taxonom', 'danh mục', 'category', 'categor'], labels: ['Backend Database Schema', 'Backend API Reference'] },
    { keywords: ['voucher', 'discount', 'coupon', 'giảm giá', 'mã giảm giá'], labels: ['Backend Database Schema', 'Backend API Reference'] },
    { keywords: ['dashboard', 'stat', 'thống kê', 'visit', 'analytics'], labels: ['Backend API Reference', 'Backend Project Structure'] },
    { keywords: ['architectur', 'kiến trúc'], labels: ['Backend AI Architecture', 'Backend Tech Stack', 'Frontend Tech Stack'] },
    { keywords: ['tech stack', 'công nghệ'], labels: ['Backend Tech Stack', 'Frontend Tech Stack'] },
    { keywords: ['coding', 'convention', 'standard', 'eslint', 'prettier'], labels: ['Backend Coding Standards', 'Frontend Coding Standards'] },
    { keywords: ['component', 'ui', 'giao diện'], labels: ['Frontend Component Architecture', 'Frontend UI Conventions'] },
    { keywords: ['state', 'redux', 'zustand'], labels: ['Frontend State Management'] },
    { keywords: ['project structure', 'cấu trúc', 'folder', 'directory'], labels: ['Backend Project Structure', 'Frontend Project Structure'] },
    { keywords: ['api', 'endpoint', 'route', 'controller'], labels: ['Backend API Reference'] },
  ];

  /**
   * Lấy toàn bộ nội dung docs từ GitHub, có cache
   */
  static async getAllDocs(): Promise<string> {
    const map = await DocsFetcher.fetchAllDocsMap();

    if (map.size === 0) {
      return '⚠️ Không thể tải tài liệu từ GitHub. Vui lòng kiểm tra kết nối.';
    }

    const sections: string[] = [];
    for (const [label, content] of map.entries()) {
      sections.push(`=== ${label} ===\n${content}\n`);
    }
    return sections.join('\n');
  }

  /**
   * Lấy docs liên quan đến query dựa trên keyword matching
   * Luôn gửi DEFAULT_LABELS + docs match topic keywords
   */
  static async getRelevantDocs(query: string): Promise<string> {
    const map = await DocsFetcher.fetchAllDocsMap();

    if (map.size === 0) {
      return '⚠️ Không thể tải tài liệu từ GitHub. Vui lòng kiểm tra kết nối.';
    }

    const matchedLabels = new Set(this.DEFAULT_LABELS);
    const lowerQuery = query.toLowerCase();

    for (const topic of this.TOPIC_MAP) {
      if (topic.keywords.some(kw => lowerQuery.includes(kw))) {
        topic.labels.forEach(l => matchedLabels.add(l));
      }
    }

    const sections: string[] = [];
    for (const label of matchedLabels) {
      const content = map.get(label);
      if (content) {
        sections.push(`=== ${label} ===\n${content}\n`);
      }
    }

    // Fallback: nếu không match label nào trong map, trả về tất cả
    if (sections.length === 0) {
      return this.getAllDocs();
    }

    return sections.join('\n');
  }
}