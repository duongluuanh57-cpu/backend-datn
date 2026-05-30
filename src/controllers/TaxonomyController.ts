/**
 * Barrel file — re-exports all taxonomy v1 sub-controllers for backward compatibility.
 * Import { TaxonomyV1Controller } from './taxonomyV1/taxonomyV1Controller.ts'
 * Import { TaxonomyV1MutationController } from './taxonomyV1/taxonomyV1MutationController.ts'
 */
export { TaxonomyV1Controller } from './taxonomyV1/taxonomyV1Controller.ts';
export { TaxonomyV1MutationController } from './taxonomyV1/taxonomyV1MutationController.ts';

import { TaxonomyV1Controller } from './taxonomyV1/taxonomyV1Controller.ts';
import { TaxonomyV1MutationController } from './taxonomyV1/taxonomyV1MutationController.ts';

export class TaxonomyController {
  static getAll = TaxonomyV1Controller.getAll;
  static getAllActive = TaxonomyV1Controller.getAllActive;
  static getById = TaxonomyV1Controller.getById;
  static create = TaxonomyV1MutationController.create;
  static update = TaxonomyV1MutationController.update;
  static remove = TaxonomyV1MutationController.remove;
}