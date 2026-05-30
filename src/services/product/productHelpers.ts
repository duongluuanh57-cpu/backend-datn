// Helper slugification
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper sizes parsing
export function parseSizes(sizeStr: string): { size: string; price: number }[] {
  if (!sizeStr) return [];
  return sizeStr.split(',').map(s => {
    const parts = s.trim().split(':');
    const sizeName = parts[0]?.trim();
    const priceVal = parseInt(parts[1]?.trim() || '0', 10);
    return { size: sizeName, price: priceVal };
  }).filter(item => item.size);
}

// Helper to find taxonomy term by name — delegates to TaxonomyTermService
import { TaxonomyTermService } from '../TaxonomyTermService.ts';

export async function findTaxonomyOnly(
  name: string,
  type: 'segment' | 'scent_group' | 'concentration' | 'category',
  tenantId: string
): Promise<any | null> {
  return TaxonomyTermService.findByName(name, type, tenantId);
}

// Resolve category names from multiple sources (old + new format)
export function resolveCategoryNames(
  product: any,
  terms?: Record<string, any[]>,
  oldCategoryName?: string,
): string {
  if ((product.categories as any[])?.length > 0) {
    const names = (product.categories as any[]).map((c: any) => c?.name).filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  if (oldCategoryName) return oldCategoryName;
  const fallback = (product as any).categoryId || (product as any).category;
  if (fallback && typeof fallback === 'string') return fallback;
  if (terms?.category?.length) {
    const names = terms.category.map((t: any) => t?.name).filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  return '';
}