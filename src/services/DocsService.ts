/**
 * Barrel file — re-exports all docs sub-services for backward compatibility.
 */
export { DocsFetcher } from './docs/docsFetcher.ts';
export { DocsSelector } from './docs/docsSelector.ts';

import { DocsFetcher } from './docs/docsFetcher.ts';
import { DocsSelector } from './docs/docsSelector.ts';

export class DocsService {
  static async getAllDocs() { return DocsSelector.getAllDocs(); }
  static async getRelevantDocs(query: string) { return DocsSelector.getRelevantDocs(query); }
  static clearCache() { DocsFetcher.clearCache(); }
}