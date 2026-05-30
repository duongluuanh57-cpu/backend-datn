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