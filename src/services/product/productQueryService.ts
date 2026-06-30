import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Product } from '../../models/Product.ts';
import { redis } from '../../config/redis.ts';
import { Brand } from '../../models/Brand.ts';
import { Tag } from '../../models/Tag.ts';
import { ProductTag } from '../../models/ProductTag.ts';
import { Category } from '../../models/Category.ts';
import { ProductImage } from '../../models/ProductImage.ts';
import { ProductVariant } from '../../models/ProductVariant.ts';
import { formatMultipleProducts } from './productFormatterService.ts';
import { resolveCategoryNames } from './productHelpers.ts';

export class ProductQueryService {
  private static CACHE_TTL = 300;

  // Cache tag slug → ID mapping to reduce DB queries (per-tenant TTL + giới hạn kích thước)
  private static tagCache = new Map<string, { data: { id: mongoose.Types.ObjectId; tenantId: string; slug: string }[]; time: number }>();
  private static TAG_CACHE_TTL = 300; // 5 minutes
  private static TAG_CACHE_MAX_SIZE = 50; // giới hạn 50 tenant entry

  private static async getTagIdsBySlugs(slugs: string[], tenantId: string): Promise<mongoose.Types.ObjectId[]> {
    const now = Date.now();
    const cacheEntry = this.tagCache.get(tenantId);
    
    // Check if we have valid cached tags for this tenant (per-tenant TTL)
    if (cacheEntry && now - cacheEntry.time < this.TAG_CACHE_TTL) {
      const tagIds: mongoose.Types.ObjectId[] = [];
      for (const slug of slugs) {
        const tag = cacheEntry.data.find(t => t.slug === slug);
        if (tag) tagIds.push(tag.id);
      }
      if (tagIds.length > 0) return tagIds;
    }
    
    // Cache miss or expired - query DB
    const tags = await Tag.find({ tenantId }).lean();
    const tagMap = new Map<string, mongoose.Types.ObjectId>();
    for (const tag of tags) {
      const slug = (tag.slug || '').toLowerCase();
      tagMap.set(slug, tag._id);
    }
    
    // Giới hạn kích thước cache
    if (this.tagCache.size >= this.TAG_CACHE_MAX_SIZE) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of this.tagCache) {
        if (v.time < oldestTime) { oldestTime = v.time; oldestKey = k; }
      }
      if (oldestKey) this.tagCache.delete(oldestKey);
    }
    
    // Update cache với per-tenant timestamp
    this.tagCache.set(tenantId, {
      data: tags.map(t => ({ id: t._id, tenantId: t.tenantId, slug: (t.slug || '').toLowerCase() })),
      time: now,
    });
    
    const tagIds: mongoose.Types.ObjectId[] = [];
    for (const slug of slugs) {
      const tagId = tagMap.get(slug.toLowerCase());
      if (tagId) tagIds.push(tagId);
    }
    return tagIds;
  }

  static async getProductIdsByTagSlugs(slugs: string[], tenantId: string): Promise<mongoose.Types.ObjectId[]> {
    const tagIds = await this.getTagIdsBySlugs(slugs, tenantId);
    if (tagIds.length === 0) return [];
    const links = await ProductTag.find({ tenantId, tagId: { $in: tagIds } }).lean();
    return links.map(l => l.productId);
  }

  static async getNewProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:new:tag:v3:${tenantId}`;
    try { const cached = await redis.get(cacheKey); if (cached) return JSON.parse(cached); } catch (err) { console.warn('Redis error in getNewProducts:', err); }
    const productIds = await this.getProductIdsByTagSlugs(['new', 'san-pham-moi'], tenantId);
    const query: any = { tenantId }; if (productIds.length > 0) query._id = { $in: productIds };
    const productsRaw = await Product.find(query)  .select('name brandId image variants categories discountPercentage discountStartDate discountEndDate soldCount createdAt longevity sillage durability scentTrail style suitableFor occasion season time description reviewsCount')
  
  
.select('name brandId image variants categories discountPercentage discountStartDate discountEndDate soldCount createdAt').populate('brandId').populate('categories').lean().sort({ createdAt: -1 }).limit(15).lean();
    const products = await formatMultipleProducts(productsRaw, tenantId);
    if (products.length > 0) { try { await redis.set(cacheKey, JSON.stringify(products), 'EX', this.CACHE_TTL); } catch (err) { console.warn('Redis set error:', err); } }
    return products;
  }

  static async getLimitedProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:limited:tag:v2:${tenantId}`;
    try { const cached = await redis.get(cacheKey); if (cached) return JSON.parse(cached); } catch (err) { console.warn('Redis error in getLimitedProducts:', err); }
    const productIds = await this.getProductIdsByTagSlugs(['limited', 'gioi-han', 'gioi-han-dac-biet'], tenantId);
    const query: any = { tenantId }; if (productIds.length > 0) query._id = { $in: productIds };
    const productsRaw = await Product.find(query).populate('brandId').populate('categories').sort({ createdAt: -1 }).limit(15).lean();
    const products = await formatMultipleProducts(productsRaw, tenantId);
    if (products.length > 0) { try { await redis.set(cacheKey, JSON.stringify(products), 'EX', this.CACHE_TTL); } catch (err) { console.warn('Redis set error:', err); } }
    return products;
  }

  static async getTrendingProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:trending:tag:v3:${tenantId}`;
    try { const cached = await redis.get(cacheKey); if (cached) return JSON.parse(cached); } catch (err) { console.warn('Redis error in getTrendingProducts:', err); }
    const productIds = await this.getProductIdsByTagSlugs(['trending', 'thinh-hanh', 'ban-chay', 'hot'], tenantId);
    const query: any = { tenantId }; if (productIds.length > 0) query._id = { $in: productIds };
    const productsRaw = await Product.find(query).populate('brandId').populate('categories').sort({ createdAt: -1 }).limit(15).lean();
    const products = await formatMultipleProducts(productsRaw, tenantId);
    if (products.length > 0) { try { await redis.set(cacheKey, JSON.stringify(products), 'EX', this.CACHE_TTL); } catch (err) { console.warn('Redis set error:', err); } }
    return products;
  }

  static async getPublicProducts(tenantId: string, type: 'trending' | 'new' | 'limited', filters: any = {}): Promise<any[]> {
    const { brand, capacity, priceRange, minPrice, maxPrice, sortBy = 'newest', limit = 20, filterTag } = filters;
    const tagSlugsMap: Record<string, string[]> = { trending: ['trending', 'thinh-hanh', 'ban-chay', 'hot'], new: ['new', 'san-pham-moi'], limited: ['limited', 'gioi-han', 'gioi-han-dac-biet'] };
    let slugs = tagSlugsMap[type] || [];
    if (filterTag) {
      const additional = filterTag.split(',').map((s: string) => s.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
      for (const a of additional) { if (!slugs.includes(a)) slugs.push(a); }
    }
    if (!slugs || slugs.length === 0) return [];
    const cachePayload = { brand, capacity, priceRange, minPrice, maxPrice, sortBy, limit, filterTag };
    const cacheHash = crypto.createHash('md5').update(JSON.stringify(cachePayload)).digest('hex');
    const cacheKey = `products:public:${type}:${tenantId}:${cacheHash}`;
    try { const cached = await redis.get(cacheKey); if (cached) return JSON.parse(cached); } catch (err) { console.warn('Redis error in getPublicProducts:', err); }
    const productIds = await this.getProductIdsByTagSlugs(slugs, tenantId);
    if (productIds.length === 0) return [];
    const productsRaw = await Product.find({ tenantId, _id: { $in: productIds } }).populate('brandId').populate('categories').sort({ createdAt: -1 }).lean();
    const products = await formatMultipleProducts(productsRaw, tenantId);
    const getActualPrice = (product: any) => { const p = product.price ?? 0; if (!p) return 0; let active = product.discountPercentage && product.discountPercentage > 0; if (active) { const now = new Date(); if (product.discountStartDate && new Date(product.discountStartDate) > now) active = false; if (product.discountEndDate && new Date(product.discountEndDate) < now) active = false; } return active ? Math.round(p * (1 - product.discountPercentage / 100)) : p; };
    const filtered = products.filter((product: any) => {
      if (brand && brand !== 'all') { const bName = (product.brand as any)?.name || (typeof product.brand === 'string' ? product.brand : '') || product.brandName || ''; if (bName.toLowerCase() !== brand.toLowerCase()) return false; }
      if (capacity && capacity !== 'all') { const parsedSizes = product.size ? product.size.split(',').map((s: string) => { const parts = s.trim().split(':'); return parts[0].trim().toLowerCase(); }).filter(Boolean) : []; if (!parsedSizes.includes(capacity.toLowerCase())) return false; }
      if (priceRange && priceRange !== 'all') { const actualPrice = getActualPrice(product); if (priceRange === 'under-1m' && actualPrice >= 1000000) return false; if (priceRange === '1m-3m' && (actualPrice < 1000000 || actualPrice > 3000000)) return false; if (priceRange === 'over-3m' && actualPrice <= 3000000) return false; }
      if (minPrice !== undefined || maxPrice !== undefined) { const actualPrice = getActualPrice(product); if (minPrice !== undefined && actualPrice < minPrice) return false; if (maxPrice !== undefined && actualPrice > maxPrice) return false; }
      return true;
    });
    if (sortBy === 'price-asc') filtered.sort((a: any, b: any) => getActualPrice(a) - getActualPrice(b));
    else if (sortBy === 'price-desc') filtered.sort((a: any, b: any) => getActualPrice(b) - getActualPrice(a));
    else if (sortBy === 'bestSeller') filtered.sort((a: any, b: any) => (b.soldCount || 0) - (a.soldCount || 0));
    else filtered.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const result = filtered.slice(0, limit);
    if (result.length > 0) { try { await redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL); } catch (err) { console.warn('Redis set error:', err); } }
    return result;
  }

  static async getSaleProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:sale:tag:${tenantId}`;
    try { const cached = await redis.get(cacheKey); if (cached) return JSON.parse(cached); } catch (err) { console.warn('Redis error in getSaleProducts:', err); }
    const saleProductIds = await this.getProductIdsByTagSlugs(['sale', 'giam-gia'], tenantId);
    const now = new Date();
    const queryBase: any = { tenantId, discountPercentage: { $gt: 0 }, discountEndDate: { $gt: now }, $or: [{ discountStartDate: null }, { discountStartDate: { $exists: false } }, { discountStartDate: { $lte: now } }] };
    if (saleProductIds.length > 0) queryBase._id = { $in: saleProductIds };
    let productsRaw: any[] = [];
    if (await Product.countDocuments(queryBase).maxTimeMS(3000)) { productsRaw = await Product.find(queryBase).populate('brandId').populate('categories').sort({ discountEndDate: 1, createdAt: -1 }).limit(12)  
.lean(); }
    const products = await formatMultipleProducts(productsRaw, tenantId);
    if (products.length > 0) { try { await redis.set(cacheKey, JSON.stringify(products), 'EX', this.CACHE_TTL); } catch (err) { console.warn('Redis set error:', err); } }
    return products;
  }

  static async getAllProducts(tenantId: string, options: any = {}): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 25, search, brand, stock, tag, category, sortBy } = options;
    const query: any = {};
    if (search) { query.$text = { $search: search }; }
    if (brand) { const brandDoc = await Brand.findOne({ name: { $regex: `^${brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }); if (brandDoc) { query.brandId = brandDoc._id; } else { return { items: [], total: 0, page, totalPages: 0 }; } }
    if (stock === 'inStock') { query.quantityInStock = { $gt: 0 }; } else if (stock === 'lowStock') { query.quantityInStock = { $gt: 0, $lt: 10 }; } else if (stock === 'outOfStock') { query.quantityInStock = 0; }
    if (tag && tag !== 'all') { const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const tagDoc = await Tag.findOne({ $or: [{ slug: { $regex: `^${escapedTag}$`, $options: 'i' } }, { name: { $regex: `^${escapedTag}$`, $options: 'i' } }] }); if (tagDoc) { const productLinks = await ProductTag.find({ tagId: tagDoc._id }).lean(); const productIds = productLinks.map(l => l.productId); if (productIds.length === 0) { return { items: [], total: 0, page, totalPages: 0 }; } if (query._id) { const existingIds = query._id.$in ? query._id.$in : [query._id]; query._id = { $in: existingIds.filter((id: any) => productIds.some((pid: any) => pid.equals(id))) }; } else { query._id = { $in: productIds }; } } else { return { items: [], total: 0, page, totalPages: 0 }; } }
    if (category) { const categoryDoc = await Category.findOne({ name: { $regex: `^${category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }); if (categoryDoc) { query.$and = query.$and || []; query.$and.push({ $or: [{ categories: categoryDoc._id }, { categoryId: categoryDoc._id }] }); } else { return { items: [], total: 0, page, totalPages: 0 }; } }
    let sort: any = { createdAt: -1 };
    switch (sortBy) { case 'priceAsc': sort = { price: 1 }; break; case 'priceDesc': sort = { price: -1 }; break; case 'stockAsc': sort = { quantityInStock: 1 }; break; case 'stockDesc': sort = { quantityInStock: -1 }; break; case 'rating': sort = { rating: -1, reviewsCount: -1 }; break; case 'newest': sort = { createdAt: -1 }; break; case 'bestSeller': sort = { soldCount: -1, createdAt: -1 }; break; }
    const total = await Product.countDocuments(query);
    const products = await Product.find(query).select('name brandId image variants categories discountPercentage discountStartDate discountEndDate soldCount createdAt').populate('brandId').populate('categories').sort(sort).skip((page - 1) * limit).limit(limit).lean()
    
    const items = await formatMultipleProducts(products, tenantId);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async getBulkProducts(tenantId: string, ids: string[]): Promise<any[]> {
    if (!ids.length) return [];
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id)).slice(0, 20).map(id => new mongoose.Types.ObjectId(id));
    if (!validIds.length) return [];
    const productsRaw = await Product.find({ _id: { $in: validIds }, tenantId }).select('name brandId image variants categories discountPercentage discountStartDate discountEndDate soldCount createdAt').populate('brandId').populate('categories').lean()
    return formatMultipleProducts(productsRaw, tenantId);
  }

  static async suggestProducts(tenantId: string, query: string, limit: number = 8): Promise<any[]> {
    if (!query || !query.trim()) {
      const randomProducts = await Product.aggregate([{ $match: { tenantId } }, { $sample: { size: limit } }, { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brand' } }, { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } }, { $project: { name: 1, image: 1, brand: '$brand.name' } }]);
      const formatted = await formatMultipleProducts(randomProducts, tenantId);
      return formatted.map((p: any) => ({ _id: p._id, name: p.name, price: p.price, image: p.image || '', brand: p.brand || '' }));
    }
    const cleanQuery = query.trim();
    const cacheKey = `products:suggest:v2:${tenantId}:${cleanQuery.toLowerCase()}`;
    try { const cached = await redis.get(cacheKey); if (cached) return JSON.parse(cached); } catch (err) { console.warn('Redis error in suggestProducts:', err); }

    // Tìm brand bằng text index (nhanh hơn $regex)
    const matchingBrands = await Brand.find(
      { tenantId, $text: { $search: cleanQuery } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } })
    const brandIds = matchingBrands.map(b => b._id);

    // Tìm product bằng text index + brand match
    const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const productsRaw = await Product.find(
      {
        tenantId,
        $or: [
          { $text: { $search: cleanQuery } },
          { name: { $regex: `^${escaped}`, $options: 'i' } }, // prefix match cho autocomplete
          ...(brandIds.length > 0 ? [{ brandId: { $in: brandIds } }] : []),
        ],
      },
      brandIds.length > 0 ? { score: { $meta: 'textScore' } } : {}
    )
      .populate('brandId', 'name')
      
      .sort(brandIds.length > 0 ? { score: { $meta: 'textScore' } } : {})
      .limit(limit)
      .lean();

    const formatted = await formatMultipleProducts(productsRaw, tenantId);
    const result = formatted.map((p: any) => ({ _id: p._id, name: p.name, price: p.price, originalPrice: p.originalPrice || p.price, discount: p.discount || 0, image: p.image || '', brand: p.brand || '' }));
    if (result.length > 0) { try { await redis.set(cacheKey, JSON.stringify(result), 'EX', 300); } catch (err) { console.warn('Redis set error in suggestProducts:', err); } }
    return result;
  }

  static async getProductById(id: string, tenantId: string): Promise<any | null> {
    let product = await Product.findOne({ _id: id, tenantId }).populate('brandId').populate('categories').lean();
    if (!product) {
      product = await Product.findOne({ _id: id }).populate('brandId').populate('categories').lean();
    }
    if (!product) return null;

    // Dùng tenantId thực từ product (đề phòng tenantId truyền vào không khớp)
    const actualTenantId = (product as any).tenantId || tenantId;

    const images = await ProductImage.find({ productId: id }).lean();
    const variantIds = (product.variants || []) as mongoose.Types.ObjectId[];
    const variants = variantIds.length > 0 ? await ProductVariant.find({ _id: { $in: variantIds } }).sort({ sortOrder: 1 }).lean() : [];

    const tagLinks = await ProductTag.find({ productId: id }).populate({ path: 'tagId', model: 'Tag', select: 'name slug' }).lean();
    const tagSlugs = tagLinks.map(l => (l.tagId as any)?.slug).filter(Boolean);

    let oldCatName = '';
    if (!(product.categories as any[])?.length) {
      const oldCatId = (product as any).categoryId;
      if (oldCatId) { try { const catDoc = await Category.findById(oldCatId).lean(); if (catDoc) oldCatName = catDoc.name; } catch (_) {} }
    }

    const variant50ml = variants.find((v: any) => v.size === '50ml') || variants[0];
    let computedPrice = variant50ml?.price || 0;
    if (computedPrice > 0 && (product as any).discountPercentage > 0) {
      const now = new Date();
      const startOk = !(product as any).discountStartDate || new Date((product as any).discountStartDate) <= now;
      const endOk = !(product as any).discountEndDate || new Date((product as any).discountEndDate) >= now;
      if (startOk && endOk) computedPrice = Math.round(computedPrice * (1 - (product as any).discountPercentage / 100));
    }

    return {
      ...product,
      price: computedPrice,
      discount: (product as any).discountPercentage || 0,
      brand: (product.brandId as any)?.name || '',
      categories: resolveCategoryNames(product, undefined, oldCatName),
      image: images[0]?.url || '',
      images: images.slice(1).map(img => img.url),
      variants: variants.map(v => ({
        _id: v._id,
        size: v.size,
        price: v.price,
        quantityInStock: v.quantityInStock,
        sku: v.sku,
        isDefault: v.isDefault,
      })),
      size: variants.map(v => `${v.size}:${v.price}`).join(', '),
      tag: tagSlugs.join(', '),
      quantityInStock: variants.reduce((sum, v) => sum + (v.quantityInStock || 0), 0),
    };
  }
}