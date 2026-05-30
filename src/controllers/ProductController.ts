/**
 * Barrel file — re-exports all product sub-controllers for backward compatibility.
 * Import { ProductListingController } from './product/productListingController.ts'
 * Import { ProductMutationController } from './product/productMutationController.ts'
 */
export { ProductListingController } from './product/productListingController.ts';
export { ProductMutationController } from './product/productMutationController.ts';

import { ProductListingController } from './product/productListingController.ts';
import { ProductMutationController } from './product/productMutationController.ts';

export class ProductController {
  // Listing methods
  static getNewProducts = ProductListingController.getNewProducts;
  static getLimitedProducts = ProductListingController.getLimitedProducts;
  static getTrendingProducts = ProductListingController.getTrendingProducts;
  static getPublicProducts = ProductListingController.getPublicProducts;
  static getSaleProducts = ProductListingController.getSaleProducts;
  static getAllProducts = ProductListingController.getAllProducts;
  static getBulkProducts = ProductListingController.getBulkProducts;
  static suggestProducts = ProductListingController.suggestProducts;
  static getProductById = ProductListingController.getProductById;

  // Mutation methods
  static updateProduct = ProductMutationController.updateProduct;
  static deleteProduct = ProductMutationController.deleteProduct;
  static bulkDeleteProducts = ProductMutationController.bulkDeleteProducts;
  static createProduct = ProductMutationController.createProduct;
}