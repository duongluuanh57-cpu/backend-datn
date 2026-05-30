/**
 * Barrel file — re-exports all taxonomy sub-controllers for backward compatibility.
 *
 * Usage (via routes):
 *   import { TaxonomyController, TaxonomyTermController } from '../controllers/TaxonomyTermController.ts'
 */

export { TaxonomyController } from './taxonomy/taxonomyController.ts';
export { TaxonomyTermController } from './taxonomy/taxonomyTermController.ts';
