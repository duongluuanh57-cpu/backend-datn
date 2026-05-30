import { DocsFetcher } from './docsFetcher.ts';

export class DocsSelector {
  private static DEFAULT_LABELS = [
    'Backend Project Structure',
    'Backend Tech Stack',
    'Backend API Conventions',
  ];

  private static parsedIndexMap: { keywords: string[]; labels: string[] }[] | null = null;

  private static buildLabelMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const doc of DocsFetcher.DOC_FILES) {
      const parts = doc.path.split('/');
      const filename = parts[parts.length - 1];
      map[filename] = doc.label;
    }
    return map;
  }

  private static async parseIndexFromMap(map: Map<string, string>): Promise<void> {
    const indexContent = map.get('Backend Docs Index');
    if (!indexContent) {
      this.parsedIndexMap = null;
      return;
    }

    const labelMap = this.buildLabelMap();
    const result: { keywords: string[]; labels: string[] }[] = [];
    const lines = indexContent.split('\n');
    let currentKeywords: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^##\s+(.+)$/);
      if (headerMatch) {
        currentKeywords = headerMatch[1].split(',').map(k => k.trim().toLowerCase());
        continue;
      }
      const fileMatch = line.match(/^-\s+(.+\.md)$/);
      if (fileMatch && currentKeywords.length > 0) {
        const file = fileMatch[1].trim();
        const label = labelMap[file];
        if (label) {
          const existing = result.find(t => t.keywords.join(',') === currentKeywords.join(','));
          if (existing) {
            if (!existing.labels.includes(label)) existing.labels.push(label);
          } else {
            result.push({ keywords: [...currentKeywords], labels: [label] });
          }
        }
      }
    }

    this.parsedIndexMap = result;
  }

  static async getAllDocs(): Promise<string> {
    const map = await DocsFetcher.fetchAllDocsMap();

    if (map.size === 0) {
      return '⚠️ Không thể tải tài liệu từ GitHub. Vui lòng kiểm tra kết nối.';
    }

    const sections: string[] = [];
    for (const [label, content] of map.entries()) {
      if (label !== 'Backend Docs Index') {
        sections.push(`=== ${label} ===\n${content}\n`);
      }
    }
    return sections.join('\n');
  }

  static async getRelevantDocs(query: string): Promise<string> {
    const map = await DocsFetcher.fetchAllDocsMap();

    if (map.size === 0) {
      return '⚠️ Không thể tải tài liệu từ GitHub. Vui lòng kiểm tra kết nối.';
    }

    if (this.parsedIndexMap === null) {
      await this.parseIndexFromMap(map);
    }

    const matchedLabels = new Set(this.DEFAULT_LABELS);
    const lowerQuery = query.toLowerCase();

    if (this.parsedIndexMap) {
      for (const topic of this.parsedIndexMap) {
        if (topic.keywords.some(kw => lowerQuery.includes(kw))) {
          topic.labels.forEach(l => matchedLabels.add(l));
        }
      }
    }

    const sections: string[] = [];
    for (const label of matchedLabels) {
      const content = map.get(label);
      if (content) {
        sections.push(`=== ${label} ===\n${content}\n`);
      }
    }

    if (sections.length === 0) {
      return this.getAllDocs();
    }

    return sections.join('\n');
  }
}
