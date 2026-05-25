import { redisService } from './RedisService.ts';

interface CachedDoc {
  content: string;
  fetchedAt: number;
}

interface DocFileConfig {
  path: string;
  label: string;
  repo: 'backend' | 'frontend';
}

/**
 * DocsService — Fetch nội dung file .md từ GitHub raw content
 * Dùng để cung cấp context cho AdminAI về codebase
 * Cache 5 phút qua Redis (hoặc in-memory fallback)
 */
export class DocsService {
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
  private static DOC_FILES: DocFileConfig[] = [
    // Backend docs (repo: backend-datn, path: Docs-Backend/)
    { path: 'Docs-Backend/AI_ARCHITECTURE.md', label: 'Backend AI Architecture', repo: 'backend' },
    { path: 'Docs-Backend/API_CONVENTIONS.md', label: 'Backend API Conventions', repo: 'backend' },
    { path: 'Docs-Backend/API_REFERENCE.md', label: 'Backend API Reference', repo: 'backend' },
    { path: 'Docs-Backend/CODING_STANDARDS.md', label: 'Backend Coding Standards', repo: 'backend' },
    { path: 'Docs-Backend/DATABASE_SCHEMA.md', label: 'Backend Database Schema', repo: 'backend' },
    { path: 'Docs-Backend/PROJECT_STRUCTURE.md', label: 'Backend Project Structure', repo: 'backend' },
    { path: 'Docs-Backend/TECH_STACK.md', label: 'Backend Tech Stack', repo: 'backend' },
    // Frontend docs (repo: frontend-datn, path: Docs-Frontend/)
    { path: 'Docs-Frontend/CODING_STANDARDS.md', label: 'Frontend Coding Standards', repo: 'frontend' },
    { path: 'Docs-Frontend/COMPONENT_ARCHITECTURE.md', label: 'Frontend Component Architecture', repo: 'frontend' },
    { path: 'Docs-Frontend/PROJECT_STRUCTURE.md', label: 'Frontend Project Structure', repo: 'frontend' },
    { path: 'Docs-Frontend/STATE_MANAGEMENT.md', label: 'Frontend State Management', repo: 'frontend' },
    { path: 'Docs-Frontend/TECH_STACK.md', label: 'Frontend Tech Stack', repo: 'frontend' },
    { path: 'Docs-Frontend/UI_CONVENTIONS.md', label: 'Frontend UI Conventions', repo: 'frontend' },
  ];

  private static localCache = new Map<string, CachedDoc>();

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
   * Fetch tất cả docs, trả về Map<label, content>
   */
  private static async fetchAllDocsMap(): Promise<Map<string, string>> {
    const backendOwner = process.env.GITHUB_REPO_OWNER || '';
    const backendRepo = process.env.GITHUB_REPO_NAME || '';
    const backendBranch = process.env.GITHUB_BRANCH || 'main';
    const frontendOwner = process.env.FRONTEND_GITHUB_REPO_OWNER || backendOwner || '';
    const frontendRepo = process.env.FRONTEND_GITHUB_REPO_NAME || 'frontend-datn';
    const frontendBranch = process.env.FRONTEND_GITHUB_BRANCH || 'main';

    const map = new Map<string, string>();

    for (const file of this.DOC_FILES) {
      try {
        const owner = file.repo === 'frontend' ? frontendOwner : backendOwner;
        const repo = file.repo === 'frontend' ? frontendRepo : backendRepo;
        const branch = file.repo === 'frontend' ? frontendBranch : backendBranch;
        const content = await this.fetchDoc(owner, repo, branch, file.path);
        if (content) {
          map.set(file.label, content);
        }
      } catch (err) {
        console.error(`❌ [DocsService] Failed to fetch ${file.path}:`, err);
      }
    }

    return map;
  }

  /**
   * Lấy toàn bộ nội dung docs từ GitHub, có cache
   */
  static async getAllDocs(): Promise<string> {
    const map = await this.fetchAllDocsMap();

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
    const map = await this.fetchAllDocsMap();

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

  /**
   * Fetch 1 file từ GitHub raw content, có cache
   */
  private static async fetchDoc(
    owner: string,
    repo: string,
    branch: string,
    path: string
  ): Promise<string | null> {
    const cacheKey = `github:doc:${owner}/${repo}/${branch}/${path}`;

    // Kiểm tra in-memory cache
    const cached = this.localCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      console.log(`📄 [DocsService] Cache hit: ${path}`);
      return cached.content;
    }

    // Kiểm tra Redis cache
    try {
      const redisCached = await redisService.get(cacheKey);
      if (redisCached) {
        this.localCache.set(cacheKey, { content: redisCached, fetchedAt: Date.now() });
        console.log(`📄 [DocsService] Redis cache hit: ${path}`);
        return redisCached;
      }
    } catch {
      // Redis không available, bỏ qua
    }

    // Fetch từ GitHub
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    console.log(`📄 [DocsService] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'L-essence-Backend/1.0',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ [DocsService] HTTP ${response.status} for ${url}`);
      return null;
    }

    const text = await response.text();

    // Lưu cache
    this.localCache.set(cacheKey, { content: text, fetchedAt: Date.now() });
    try {
      await redisService.set(cacheKey, text);
    } catch {
      // Redis không available
    }

    return text;
  }

  /**
   * Xoá cache — gọi khi admin muốn refresh docs
   */
  static clearCache() {
    this.localCache.clear();
    console.log('🗑️ [DocsService] Cache cleared');
  }
}