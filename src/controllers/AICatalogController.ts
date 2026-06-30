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
export { generateCategory, createCategoryFromAI } from './aiCatalog/generateCategoryController.ts';
export { generateTag, createTagFromAI } from './aiCatalog/generateTagController.ts';
export { generateUser, createUserFromAI } from './aiCatalog/generateUserController.ts';
export { generateVoucher, createVoucherFromAI } from './aiCatalog/generateVoucherController.ts';
export { autocomplete } from './aiCatalog/autocompleteController.ts';
export { suggestPrice } from './aiCatalog/suggestPriceController.ts';

// Re-import cho backward-compatible class
import { generateProduct as _generateProduct } from './aiCatalog/generateProductController.ts';
import { generateBrand as _generateBrand } from './aiCatalog/generateBrandController.ts';
import { generateCategory as _generateCategory, createCategoryFromAI as _createCategoryFromAI } from './aiCatalog/generateCategoryController.ts';
import { generateTag as _generateTag, createTagFromAI as _createTagFromAI } from './aiCatalog/generateTagController.ts';
import { generateUser as _generateUser, createUserFromAI as _createUserFromAI } from './aiCatalog/generateUserController.ts';
import { generateVoucher as _generateVoucher, createVoucherFromAI as _createVoucherFromAI } from './aiCatalog/generateVoucherController.ts';
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

  static async generateCategory(req: FastifyRequest, reply: FastifyReply) {
    return _generateCategory(req, reply);
  }
  static async createCategoryFromAI(req: FastifyRequest, reply: FastifyReply) {
    return _createCategoryFromAI(req, reply);
  }

  static async generateTag(req: FastifyRequest, reply: FastifyReply) {
    return _generateTag(req, reply);
  }
  static async createTagFromAI(req: FastifyRequest, reply: FastifyReply) {
    return _createTagFromAI(req, reply);
  }

  static async generateUser(req: FastifyRequest, reply: FastifyReply) {
    return _generateUser(req, reply);
  }
  static async createUserFromAI(req: FastifyRequest, reply: FastifyReply) {
    return _createUserFromAI(req, reply);
  }

  static async generateVoucher(req: FastifyRequest, reply: FastifyReply) {
    return _generateVoucher(req, reply);
  }
  static async createVoucherFromAI(req: FastifyRequest, reply: FastifyReply) {
    return _createVoucherFromAI(req, reply);
  }

  static async autocomplete(req: FastifyRequest, reply: FastifyReply) {
    return _autocomplete(req, reply);
  }

  static async suggestPrice(req: FastifyRequest, reply: FastifyReply) {
    return _suggestPrice(req, reply);
  }
}
