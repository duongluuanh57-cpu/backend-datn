/**
 * AICatalogController — Barrel file (re-export từ các module nhỏ hơn)
 *
 * File này được giữ lại để backward compatibility.
 * Code thực tế đã được tách vào thư mục `controllers/aiCatalog/`:
 *   - sanitizeJson.ts              → sanitizeJsonString
 *   - generateProductController.ts → generateProduct
 *   - generateBrandController.ts   → generateBrand
 *   - autocompleteController.ts    → autocomplete
 *   - suggestPriceController.ts    → suggestPrice
 */
export { sanitizeJsonString } from './aiCatalog/sanitizeJson.ts';
export { generateProduct } from './aiCatalog/generateProductController.ts';
export { generateBrand } from './aiCatalog/generateBrandController.ts';
export { autocomplete } from './aiCatalog/autocompleteController.ts';
export { suggestPrice } from './aiCatalog/suggestPriceController.ts';

// Re-import cho backward-compatible class
import { generateProduct as _generateProduct } from './aiCatalog/generateProductController.ts';
import { generateBrand as _generateBrand } from './aiCatalog/generateBrandController.ts';
import { autocomplete as _autocomplete } from './aiCatalog/autocompleteController.ts';
import { suggestPrice as _suggestPrice } from './aiCatalog/suggestPriceController.ts';

import type { FastifyRequest, FastifyReply } from 'fastify';

// ============================================================
// Backward-compatible AICatalogController class
// Giữ nguyên tên class + method signatures để không break imports
// ============================================================
export class AICatalogController {
  static async generateProduct(req: FastifyRequest, reply: FastifyReply) {
    return _generateProduct(req, reply);
  }

  static async generateBrand(req: FastifyRequest, reply: FastifyReply) {
    return _generateBrand(req, reply);
  }

  static async autocomplete(req: FastifyRequest, reply: FastifyReply) {
    return _autocomplete(req, reply);
  }

  static async suggestPrice(req: FastifyRequest, reply: FastifyReply) {
    return _suggestPrice(req, reply);
  }
}