/**
 * Barrel file — re-exports all brand sub-controllers for backward compatibility.
 * Import { BrandListingController } from './brand/brandListingController.ts'
 * Import { BrandMutationController } from './brand/brandMutationController.ts'
 */
export { BrandListingController } from './brand/brandListingController.ts';
export { BrandMutationController } from './brand/brandMutationController.ts';

import { BrandListingController } from './brand/brandListingController.ts';
import { BrandMutationController } from './brand/brandMutationController.ts';

export class BrandController {
  static getAllBrands = BrandListingController.getAllBrands;
  static getBrandOrigins = BrandListingController.getBrandOrigins;
  static getBrandById = BrandListingController.getBrandById;
  static createBrand = BrandMutationController.createBrand;
  static updateBrand = BrandMutationController.updateBrand;
  static deleteBrand = BrandMutationController.deleteBrand;
  static bulkDeleteBrands = BrandMutationController.bulkDeleteBrands;
}