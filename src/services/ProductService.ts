/**
 * ProductService — Barrel file (re-export từ các module nhỏ hơn)
 *
 * File này được giữ lại để backward compatibility.
 * Code thực tế đã được tách vào thư mục `services/product/`:
 *   - productHelpers.ts           → slugify, parseSizes, findTaxonomyOnly, resolveCategoryNames
 *   - productFormatterService.ts  → formatMultipleProducts
 *   - productQueryService.ts      → ProductQueryService (getNewProducts, getLimitedProducts, getTrendingProducts, getSaleProducts, getAllProducts, getProductById)
 *   - productMutationService.ts   → ProductMutationService (createProduct, updateProduct, deleteProduct, bulkDeleteProducts)
 */
export { slugify, parseSizes, resolveCategoryNames } from './product/productHelpers.ts';
export { formatMultipleProducts } from './product/productFormatterService.ts';
export { ProductQueryService } from './product/productQueryService.ts';
export { ProductMutationService } from './product/productMutationService.ts';

// Re-import cho backward-compatible class
import { ProductQueryService as _ProductQueryService } from './product/productQueryService.ts';
import { ProductMutationService as _ProductMutationService } from './product/productMutationService.ts';

// ============================================================
// Backward-compatible ProductService class
// Giữ nguyên tên class + method signatures để không break imports
// ============================================================
export class ProductService {
  private static CACHE_TTL = 300;

  // --- Query methods ---
  static async getProductIdsByTagSlugs(slugs: string[], tenantId: string) {
    return _ProductQueryService.getProductIdsByTagSlugs(slugs, tenantId);
  }
  static async getNewProducts(tenantId: string) {
    return _ProductQueryService.getNewProducts(tenantId);
  }
  static async getLimitedProducts(tenantId: string) {
    return _ProductQueryService.getLimitedProducts(tenantId);
  }
  static async getTrendingProducts(tenantId: string) {
    return _ProductQueryService.getTrendingProducts(tenantId);
  }
  static async getSaleProducts(tenantId: string) {
    return _ProductQueryService.getSaleProducts(tenantId);
  }
  static async getPublicProducts(tenantId: string, type: 'trending' | 'new' | 'limited', filters: any = {}) {
    return _ProductQueryService.getPublicProducts(tenantId, type, filters);
  }
  static async getAllProducts(tenantId: string, options: any = {}) {
    return _ProductQueryService.getAllProducts(tenantId, options);
  }
  static async getBulkProducts(tenantId: string, ids: string[]) {
    return _ProductQueryService.getBulkProducts(tenantId, ids);
  }
  static async suggestProducts(tenantId: string, query: string, limit?: number) {
    return _ProductQueryService.suggestProducts(tenantId, query, limit);
  }
  static async getProductById(id: string, tenantId: string) {
    return _ProductQueryService.getProductById(id, tenantId);
  }

  // --- Mutation methods ---
  static async createProduct(data: any, tenantId: string) {
    return _ProductMutationService.createProduct(data, tenantId);
  }
  static async updateProduct(id: string, data: any, tenantId: string) {
    return _ProductMutationService.updateProduct(id, data, tenantId);
  }
  static async deleteProduct(id: string, tenantId: string) {
    return _ProductMutationService.deleteProduct(id, tenantId);
  }
  static async bulkDeleteProducts(ids: string[], tenantId: string) {
    return _ProductMutationService.bulkDeleteProducts(ids, tenantId);
  }
}
