/**
 * productTaxonomyResolver — Resolve tag, brand, category từ AI output sang DB entities
 */
import { FuzzyMatchCache } from '../../services/FuzzyMatchCache.ts';

export interface TaxonomyContext {
  allTags: { lookup: Map<string, any>; items: any[] };
  allBrands: { lookup: Map<string, any>; items: any[] };
  allCategories: { lookup: Map<string, any>; items: any[] };
}

/**
 * Resolve tags từ AI output: Standard + 1 tag do AI chọn (hoặc random nếu thiếu)
 */
export function resolveTags(
  aiTag: string | undefined,
  hasValidSale: boolean,
  ctx: TaxonomyContext
): { tagIds: any[]; tagNames: string[] } {
  const tagIds: any[] = [];
  const tagNames: string[] = [];
  const standardTag = ctx.allTags.lookup.get('standard');
  const saleTagEntry = ctx.allTags.lookup.get('sale');

  // 1. Standard tag luôn được thêm
  if (standardTag) {
    tagIds.push(standardTag._id);
    tagNames.push(standardTag.name);
    console.log(`✅ Standard tag auto-added: ${standardTag.name}`);
  }

  // 2. Tag từ AI
  if (aiTag) {
    const matched = FuzzyMatchCache.fuzzyFind(aiTag, ctx.allTags.lookup, (t: any) => t.name);
    if (matched && FuzzyMatchCache.normalize(matched.name) !== 'standard') {
      const isSale = FuzzyMatchCache.normalize(matched.name) === 'sale';
      if (isSale && !hasValidSale) {
        console.log(`⚠️ AI picked "Sale" but discount does NOT qualify — skipping Sale tag`);
      } else {
        tagIds.push(matched._id);
        tagNames.push(matched.name);
        console.log(`✅ AI tag resolved: ${matched.name}`);
      }
    }
  }

  // 3. Auto-add Sale nếu đủ điều kiện nhưng chưa được chọn
  if (hasValidSale && saleTagEntry && !tagNames.some(n => FuzzyMatchCache.normalize(n) === 'sale')) {
    tagIds.push(saleTagEntry._id);
    tagNames.push(saleTagEntry.name);
    console.log(`✅ Sale tag auto-added`);
  }

  // 4. Fallback: thêm 1 tag random nếu chỉ có Standard
  if (tagIds.length < 2) {
    for (const [norm, tag] of ctx.allTags.lookup) {
      if (norm === 'standard') continue;
      tagIds.push(tag._id);
      tagNames.push(tag.name);
      console.log(`✅ Extra tag auto-added: ${tag.name}`);
      break;
    }
  }

  return { tagIds, tagNames };
}

/**
 * Resolve brand từ tên AI output → ObjectId trong DB
 */
export function resolveBrand(
  brandName: string | undefined,
  ctx: TaxonomyContext
): { brandId?: any; brandName?: string } {
  if (!brandName) return {};

  const matched = FuzzyMatchCache.fuzzyFind(brandName, ctx.allBrands.lookup, (b: any) => b.name);
  if (matched) {
    console.log(`✅ Brand resolved: ${matched.name} (ID: ${matched._id})`);
    return { brandId: matched._id, brandName: matched.name };
  }

  console.warn(`⚠️ Brand "${brandName}" not found in database, keeping as-is`);
  return { brandName };
}

/**
 * Resolve categories từ AI output → ObjectId array (đảm bảo ít nhất 2)
 */
export function resolveCategories(
  aiCategory: string | undefined,
  ctx: TaxonomyContext
): { categoryIds: any[]; categoryNames: string[] } {
  const catNames: string[] = [];
  const catIds: any[] = [];

  // 1. Parse từ AI output
  if (aiCategory) {
    const names = String(aiCategory).split(',').map((s: string) => s.trim()).filter(Boolean);
    const matched = names
      .map(n => FuzzyMatchCache.fuzzyFind(n, ctx.allCategories.lookup, (c: any) => c.name))
      .filter(Boolean);
    for (const c of matched) {
      if (!catNames.includes(c.name)) {
        catNames.push(c.name);
        catIds.push(c._id);
      }
    }
  }

  // 2. Fallback: fill đủ 2 nếu thiếu
  for (const c of (ctx.allCategories.items || [])) {
    if (catNames.length >= 2) break;
    if (!catNames.includes(c.name)) {
      catNames.push(c.name);
      catIds.push(c._id);
    }
  }

  if (catNames.length > 0) {
    console.log(`✅ category resolved: ${catNames.join(', ')}`);
  } else {
    console.warn(`⚠️ No categories found in database`);
  }

  return { categoryIds: catIds, categoryNames: catNames };
}