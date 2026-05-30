import { redisService } from '../RedisService.ts';

interface CachedDoc {
  content: string;
  fetchedAt: number;
}

interface DocFileConfig {
  path: string;
  label: string;
  repo: 'backend' | 'frontend';
}

export class DocsFetcher {
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
  private static localCache = new Map<string, CachedDoc>();

  static readonly DOC_FILES: DocFileConfig[] = [
    { path: 'Docs-Backend/INDEX.md', label: 'Backend Docs Index', repo: 'backend' },
    // Backend docs (repo: backend-datn, path: Docs-Backend/)
    { path: 'Docs-Backend/structure.md', label: 'Backend Project Structure', repo: 'backend' },
    { path: 'Docs-Backend/tech-stack.md', label: 'Backend Tech Stack', repo: 'backend' },
    { path: 'Docs-Backend/api-conventions.md', label: 'Backend API Conventions', repo: 'backend' },
    { path: 'Docs-Backend/coding-standards.md', label: 'Backend Coding Standards', repo: 'backend' },
    { path: 'Docs-Backend/deployment.md', label: 'Backend Deployment', repo: 'backend' },
    { path: 'Docs-Backend/env-variables.md', label: 'Backend Environment Variables', repo: 'backend' },
    { path: 'Docs-Backend/failover-selfhealing.md', label: 'Backend Failover Self-Healing', repo: 'backend' },
    { path: 'Docs-Backend/payment-voucher.md', label: 'Backend Payment Voucher', repo: 'backend' },
    { path: 'Docs-Backend/testing.md', label: 'Backend Testing', repo: 'backend' },
    { path: 'Docs-Backend/batch-concurrency.md', label: 'Backend Batch Concurrency', repo: 'backend' },
    { path: 'Docs-Backend/db-overview.md', label: 'Backend DB Overview', repo: 'backend' },
    { path: 'Docs-Backend/db-users.md', label: 'Backend DB Users', repo: 'backend' },
    { path: 'Docs-Backend/db-products.md', label: 'Backend DB Products', repo: 'backend' },
    { path: 'Docs-Backend/db-orders.md', label: 'Backend DB Orders', repo: 'backend' },
    { path: 'Docs-Backend/db-brands.md', label: 'Backend DB Brands', repo: 'backend' },
    { path: 'Docs-Backend/db-taxonomies.md', label: 'Backend DB Taxonomies', repo: 'backend' },
    { path: 'Docs-Backend/db-vouchers.md', label: 'Backend DB Vouchers', repo: 'backend' },
    { path: 'Docs-Backend/db-homepage.md', label: 'Backend DB Homepage', repo: 'backend' },
    { path: 'Docs-Backend/api-auth.md', label: 'Backend API Auth', repo: 'backend' },
    { path: 'Docs-Backend/api-products.md', label: 'Backend API Products', repo: 'backend' },
    { path: 'Docs-Backend/api-orders.md', label: 'Backend API Orders', repo: 'backend' },
    { path: 'Docs-Backend/api-users.md', label: 'Backend API Users', repo: 'backend' },
    { path: 'Docs-Backend/api-brands.md', label: 'Backend API Brands', repo: 'backend' },
    { path: 'Docs-Backend/api-taxonomies.md', label: 'Backend API Taxonomies', repo: 'backend' },
    { path: 'Docs-Backend/api-vouchers.md', label: 'Backend API Vouchers', repo: 'backend' },
    { path: 'Docs-Backend/api-media.md', label: 'Backend API Media', repo: 'backend' },
    { path: 'Docs-Backend/api-homepage.md', label: 'Backend API Homepage', repo: 'backend' },
    { path: 'Docs-Backend/api-dashboard.md', label: 'Backend API Dashboard', repo: 'backend' },
    { path: 'Docs-Backend/api-ai.md', label: 'Backend API AI', repo: 'backend' },
    { path: 'Docs-Backend/api-system.md', label: 'Backend API System', repo: 'backend' },
    { path: 'Docs-Backend/ai-overview.md', label: 'Backend AI Overview', repo: 'backend' },
    { path: 'Docs-Backend/ai-admin-chat.md', label: 'Backend AI Admin Chat', repo: 'backend' },
    { path: 'Docs-Backend/ai-batch-chat.md', label: 'Backend AI Batch Chat', repo: 'backend' },
    { path: 'Docs-Backend/ai-embedding.md', label: 'Backend AI Embedding', repo: 'backend' },
    // Frontend docs (repo: frontend-datn, path: Docs-Frontend/)
    { path: 'Docs-Frontend/INDEX.md', label: 'Frontend Docs Index', repo: 'frontend' },
    { path: 'Docs-Frontend/structure.md', label: 'Frontend Project Structure', repo: 'frontend' },
    { path: 'Docs-Frontend/data-flow.md', label: 'Frontend Data Flow', repo: 'frontend' },
    { path: 'Docs-Frontend/tech-stack.md', label: 'Frontend Tech Stack', repo: 'frontend' },
    { path: 'Docs-Frontend/coding-standards.md', label: 'Frontend Coding Standards', repo: 'frontend' },
    { path: 'Docs-Frontend/api-patterns.md', label: 'Frontend API Patterns', repo: 'frontend' },
    { path: 'Docs-Frontend/component-architecture.md', label: 'Frontend Component Architecture', repo: 'frontend' },
    { path: 'Docs-Frontend/state-management.md', label: 'Frontend State Management', repo: 'frontend' },
    { path: 'Docs-Frontend/ui-conventions.md', label: 'Frontend UI Conventions', repo: 'frontend' },
    { path: 'Docs-Frontend/env-variables.md', label: 'Frontend Environment Variables', repo: 'frontend' },
  ];

  /**
   * Fetch 1 file từ GitHub raw content, có cache
   */
  static async fetchDoc(
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
   * Fetch tất cả docs, trả về Map<label, content>
   */
  static async fetchAllDocsMap(): Promise<Map<string, string>> {
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
   * Xoá cache — gọi khi admin muốn refresh docs
   */
  static clearCache() {
    this.localCache.clear();
    console.log('🗑️ [DocsService] Cache cleared');
  }
}