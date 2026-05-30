/**
 * Barrel file — re-exports all taxonomy term sub-services for backward compatibility.
 *
 * Usage:
 *   import { TaxonomyService, TaxonomyTermService, ProductTaxonomyTermService }
 *     from '../services/TaxonomyTermService.ts'
 */
export { TaxonomyService } from './taxonomyTerm/taxonomyService.ts';
export { TaxonomyTermService } from './taxonomyTerm/taxonomyTermService.ts';
export { ProductTaxonomyTermService } from './taxonomyTerm/productTaxonomyTermService.ts';