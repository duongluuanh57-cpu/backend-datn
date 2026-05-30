import mongoose from 'mongoose';
import { Product } from '../../models/Product.ts';
import { ProductImage } from '../../models/ProductImage.ts';
import { ProductVariant } from '../../models/ProductVariant.ts';
import { ProductTag } from '../../models/ProductTag.ts';
import { Category } from '../../models/Category.ts';
import { slugify, resolveCategoryNames } from './productHelpers.ts';

/**
 * Format multiple product raw lean documents into frontend-friendly flat objects
 */
export async function formatMultipleProducts(products: any[], tenantId: string): Promise<any[]> {
  if (products.length === 0) return [];

  const productIds = products.map(p => p._id.toString());

  // Fetch images in bulk
  const images = await ProductImage.find({ productId: { $in: productIds }, tenantId }).lean();
  const imageMap = new Map<string, string[]>();
  for (const img of images) {
    const pId = img.productId.toString();
    if (!imageMap.has(pId)) {
      imageMap.set(pId, []);
    }
    imageMap.get(pId)!.push(img.url);
  }

  // Fetch variants in bulk via Product.variants references
  const allVariantIds = products.flatMap(p => (p.variants || []).map((v: any) => v.toString()));
  const variants = allVariantIds.length > 0
    ? await ProductVariant.find({ _id: { $in: allVariantIds }, tenantId }).sort({ sortOrder: 1 }).lean()
    : [];

  // Build variantId -> variant lookup
  const variantById = new Map<string, any>();
  for (const v of variants) {
    variantById.set(v._id.toString(), v);
  }

  // Fetch taxonomy terms in bulk qua bảng trung gian
  const { ProductTaxonomyTerm } = await import('../../models/ProductTaxonomyTerm.ts');
  const termLinks = await ProductTaxonomyTerm.find({ productId: { $in: productIds }, tenantId })
    .populate({ path: 'termId', model: 'TaxonomyTerm', select: 'name slug' })
    .populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug' })
    .lean();

  // Build productId -> { scent_group: [], concentration: [], segment: [], category: [] }
  const termMap = new Map<string, Record<string, any[]>>();
  for (const link of termLinks) {
    const pId = (link.productId as any).toString();
    if (!termMap.has(pId)) {
      termMap.set(pId, { scent_group: [], concentration: [], segment: [], category: [] });
    }
    const slug = (link.taxonomyId as any)?.slug;
    if (slug && termMap.get(pId)![slug]) {
      termMap.get(pId)![slug].push(link.termId);
    }
  }

  // Fetch tags in bulk qua bảng trung gian ProductTag
  const tagLinks = await ProductTag.find({ productId: { $in: productIds }, tenantId })
    .populate({ path: 'tagId', model: 'Tag', select: 'name slug' })
    .lean();

  // Build productId -> tag slug[]
  const tagMap = new Map<string, string[]>();
  for (const link of tagLinks) {
    const pId = (link.productId as any).toString();
    if (!tagMap.has(pId)) tagMap.set(pId, []);
    const slug = (link.tagId as any)?.slug;
    if (slug) tagMap.get(pId)!.push(slug);
  }

  // Fetch SEO data in bulk
  const { ProductSEO } = await import('../../models/ProductSEO.ts');
  const productObjectIds = productIds.map(id => new mongoose.Types.ObjectId(id));
  const seoDocs = await ProductSEO.find({ productId: { $in: productObjectIds }, tenantId }).lean();
  const seoMap = new Map<string, any>();
  for (const seo of seoDocs) {
    const pId = seo.productId.toString();
    seoMap.set(pId, {
      metaTitle: seo.metaTitle || '',
      metaDescription: seo.metaDescription || '',
      keywords: seo.keywords || [],
      slug: seo.slug || '',
      priceReport: seo.priceReport || '',
      sizeReport: seo.sizeReport || '',
      discountReport: seo.discountReport || '',
    });
  }

  // Bulk resolve old categoryId (pre-migration single field) → name
  const oldCatMap = new Map<string, string>();
  const oldCatIds = products
    .filter(p => !(p.categories as any[])?.length && (p as any).categoryId)
    .map(p => (p as any).categoryId)
    .filter(Boolean);
  if (oldCatIds.length > 0) {
    const catDocs = await Category.find({ _id: { $in: oldCatIds }, tenantId }).lean();
    for (const cat of catDocs) {
      oldCatMap.set(cat._id.toString(), cat.name);
    }
  }

  return products.map(product => {
    const pId = product._id.toString();
    const productImages = imageMap.get(pId) || [];
    const terms = termMap.get(pId) || { scent_group: [], concentration: [], segment: [], category: [] };
    const seoData = seoMap.get(pId) || {};

    // Resolve variants for this product in order
    const productVariants = (product.variants || [])
      .map((vId: any) => variantById.get(vId.toString()))
      .filter(Boolean);

    return {
      ...product,
      ...seoData,
      brand: (product.brandId as any)?.name || '',
      image: productImages[0] || '',
      images: productImages.slice(1),
      size: productVariants.map((v: any) => `${v.size}:${v.price}`).join(', '),
      tag: (tagMap.get(pId) || []).join(', '),
      scentGroup: terms.scent_group.map((t: any) => t?.name).filter(Boolean).join(', '),
      concentration: terms.concentration.map((t: any) => t?.name).filter(Boolean).join(', '),
      segment: terms.segment.map((t: any) => t?.name).filter(Boolean).join(', '),
      categories: resolveCategoryNames(product, terms, oldCatMap.get((product as any).categoryId?.toString())),
      quantityInStock: productVariants.reduce((sum: number, v: any) => sum + (v.quantityInStock || 0), 0) || product.quantityInStock
    };
  });
}