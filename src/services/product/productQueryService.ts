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
import { ProductTaxonomyTermService } from '../TaxonomyTermService.ts';
import { resolveCategoryNames, slugify } from './productHelpers.ts';

export class ProductQueryService {
  private static CACHE_TTL = 300; // 5 minutes

  /**
   * Helper: lấy productIds có tag theo slug list
   */
  static async getProductIdsByTagSlugs(slugs: string[], tenantId: string): Promise<mongoose.Types.ObjectId[]> {
    // Dùng $or + $regex để match case-insensitive (DB slug "Limited" match "limited")
    const tags = await Tag.find({
      tenantId,
      $or: slugs.map(s => ({ slug: new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }))
    }).lean();
    if (tags.length === 0) return [];
    const tagIds = tags.map(t => t._id);
    const links = await ProductTag.find({ tenantId, tagId: { $in: tagIds } }).lean();
    return links.map(l => l.productId);
  }

  /**
   * Lấy danh sách sản phẩm mới nhất
   */
  static async getNewProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:new:tag:v3:${tenantId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn('Redis error in getNewProducts:', err);
    }

    const productIds = await this.getProductIdsByTagSlugs(['new', 'san-pham-moi'], tenantId);
    const query: any = { tenantId };
    if (productIds.length > 0) query._id = { $in: productIds };

    const productsRaw = await Product.find(query)
      .populate('brandId')
      .populate('categories')
      .sort({ createdAt: -1 })
      .lean();

    const products = await formatMultipleProducts(productsRaw, tenantId);

    if (products.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(products), 'EX', this.CACHE_TTL);
      } catch (err) {
        console.warn('Redis set error:', err);
      }
    }

    return products;
  }

  /**
   * Lấy danh sách sản phẩm giới hạn (tag: 'Limited')
   */
  static async getLimitedProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:limited:tag:v2:${tenantId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn('Redis error in getLimitedProducts:', err);
    }

    const productIds = await this.getProductIdsByTagSlugs(['limited', 'gioi-han', 'gioi-han-dac-biet'], tenantId);
    const query: any = { tenantId };
    if (productIds.length > 0) query._id = { $in: productIds };

    const productsRaw = await Product.find(query)
      .populate('brandId')
      .populate('categories')
      .sort({ createdAt: -1 })
      .lean();

    const products = await formatMultipleProducts(productsRaw, tenantId);

    if (products.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(products), 'EX', this.CACHE_TTL);
      } catch (err) {
        console.warn('Redis set error:', err);
      }
    }

    return products;
  }

  /**
   * Lấy danh sách sản phẩm thịnh hành (tag: 'Trending')
   */
  static async getTrendingProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:trending:tag:v3:${tenantId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn('Redis error in getTrendingProducts:', err);
    }

    const productIds = await this.getProductIdsByTagSlugs(['trending', 'thinh-hanh', 'ban-chay', 'hot'], tenantId);
    const query: any = { tenantId };
    if (productIds.length > 0) query._id = { $in: productIds };

    const productsRaw = await Product.find(query)
      .populate('brandId')
      .populate('categories')
      .sort({ createdAt: -1 })
      .lean();

    const products = await formatMultipleProducts(productsRaw, tenantId);

    if (products.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(products), 'EX', this.CACHE_TTL);
      } catch (err) {
        console.warn('Redis set error:', err);
      }
    }

    return products;
  }

  /**
   * Lấy danh sách sản phẩm public với filter/sort/limit server-side (type: trending|new|limited)
   */
  static async getPublicProducts(
    tenantId: string,
    type: 'trending' | 'new' | 'limited',
    filters: {
      brand?: string;
      capacity?: string;
      priceRange?: string;
      minPrice?: number;
      maxPrice?: number;
      scentGroup?: string;
      concentration?: string;
      segment?: string;
      sortBy?: string;
      limit?: number;
      filterTag?: string;
    } = {}
  ): Promise<any[]> {
    const { brand, capacity, priceRange, minPrice, maxPrice, scentGroup, concentration, segment, sortBy = 'newest', limit = 20, filterTag } = filters;

    // Merge filterTag (từ admin config) vào danh sách tag slugs mặc định
    const tagSlugsMap: Record<string, string[]> = {
      trending: ['trending', 'thinh-hanh', 'ban-chay', 'hot'],
      new: ['new', 'san-pham-moi'],
      limited: ['limited', 'gioi-han', 'gioi-han-dac-biet'],
    };
    let slugs = tagSlugsMap[type] || [];
    if (filterTag) {
      // Thêm filterTag từ admin config vào danh sách slugs, không thay thế
      const additional = filterTag.split(',').map(s => s.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
      for (const a of additional) {
        if (!slugs.includes(a)) slugs.push(a);
      }
    }
    if (!slugs || slugs.length === 0) return [];

    const cachePayload = { brand, capacity, priceRange, minPrice, maxPrice, scentGroup, concentration, segment, sortBy, limit, filterTag };
    const cacheHash = crypto.createHash('md5').update(JSON.stringify(cachePayload)).digest('hex');
    const cacheKey = `products:public:${type}:${tenantId}:${cacheHash}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn('Redis error in getPublicProducts:', err);
    }

    const productIds = await this.getProductIdsByTagSlugs(slugs, tenantId);
    // Nếu không có sản phẩm nào khớp tag → trả về rỗng, không lấy hết sản phẩm
    if (productIds.length === 0) return [];

    const productsRaw = await Product.find({ tenantId, _id: { $in: productIds } })
      .populate('brandId')
      .populate('categories')
      .sort({ createdAt: -1 })
      .lean();

    const products = await formatMultipleProducts(productsRaw, tenantId);

    const getActualPrice = (product: any) => {
      if (!product.price) return 0;
      let active = false;
      if (product.discountPercentage && product.discountPercentage > 0) {
        active = true;
        const now = new Date();
        if (product.discountStartDate && new Date(product.discountStartDate) > now) active = false;
        if (product.discountEndDate && new Date(product.discountEndDate) < now) active = false;
      }
      if (active) return product.price * (1 - (product.discountPercentage || 0) / 100);
      return product.price;
    };

    const normalizeText = (value: string) =>
      value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const fieldContains = (fieldValue: string | undefined, selectedValue: string | undefined): boolean => {
      if (!selectedValue || selectedValue === 'all') return true;
      if (!fieldValue) return false;
      const selected = normalizeText(selectedValue);
      return fieldValue.split(',').map((item) => normalizeText(item)).filter(Boolean).includes(selected);
    };

    const filtered = products.filter((product: any) => {
      if (brand && brand !== 'all') {
        const bName = (product.brand as any)?.name || (typeof product.brand === 'string' ? product.brand : '') || product.brandName || '';
        if (bName.toLowerCase() !== brand.toLowerCase()) return false;
      }

      if (capacity && capacity !== 'all') {
        const parsedSizes = product.size
          ? product.size.split(',').map((s: string) => { const parts = s.trim().split(':'); return parts[0].trim().toLowerCase(); }).filter(Boolean)
          : [];
        if (!parsedSizes.includes(capacity.toLowerCase())) return false;
      }

      if (!fieldContains(product.scentGroup, scentGroup)) return false;
      if (!fieldContains(product.concentration, concentration)) return false;
      if (!fieldContains(product.segment, segment)) return false;

      if (priceRange && priceRange !== 'all') {
        const actualPrice = getActualPrice(product);
        if (priceRange === 'under-1m' && actualPrice >= 1000000) return false;
        if (priceRange === '1m-3m' && (actualPrice < 1000000 || actualPrice > 3000000)) return false;
        if (priceRange === 'over-3m' && actualPrice <= 3000000) return false;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        const actualPrice = getActualPrice(product);
        if (minPrice !== undefined && actualPrice < minPrice) return false;
        if (maxPrice !== undefined && actualPrice > maxPrice) return false;
      }

      return true;
    });

    filtered.sort((a: any, b: any) => {
      if (sortBy === 'price-asc') return getActualPrice(a) - getActualPrice(b);
      if (sortBy === 'price-desc') return getActualPrice(b) - getActualPrice(a);
      if (sortBy === 'bestSeller') return (b.soldCount || 0) - (a.soldCount || 0);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    const result = filtered.slice(0, limit);

    if (result.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL);
      } catch (err) {
        console.warn('Redis set error:', err);
      }
    }

    return result;
  }

  /**
   * Lấy danh sách sản phẩm giảm giá (tag: 'Sale')
   */
  static async getSaleProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:sale:tag:${tenantId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn('Redis error in getSaleProducts:', err);
    }

    const saleProductIds = await this.getProductIdsByTagSlugs(['sale', 'giam-gia'], tenantId);
    const now = new Date();

    const queryBase: any = {
      tenantId,
      discountPercentage: { $gt: 0 },
      discountEndDate: { $gt: now },
      $or: [
        { discountStartDate: null },
        { discountStartDate: { $exists: false } },
        { discountStartDate: { $lte: now } }
      ]
    };
    if (saleProductIds.length > 0) queryBase._id = { $in: saleProductIds };

    let productsRaw: any[] = [];

    if (await Product.countDocuments(queryBase).maxTimeMS(3000)) {
      productsRaw = await Product.find(queryBase)
        .populate('brandId')
        .populate('categories')
        .sort({ discountEndDate: 1, createdAt: -1 })
        .limit(20)
        .lean();
    }

    const products = await formatMultipleProducts(productsRaw, tenantId);

    // 3. Lưu vào Cache
    if (products.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(products), 'EX', this.CACHE_TTL);
      } catch (err) {
        console.warn('Redis set error:', err);
      }
    }

    return products;
  }

  /**
   * Lấy tất cả sản phẩm của tenant với phân trang, lọc, sắp xếp
   */
  static async getAllProducts(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      brand?: string;
      stock?: string;
      tag?: string;
      category?: string;
      sortBy?: string;
    } = {}
  ): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 25, search, brand, stock, tag, category, sortBy } = options;

    const query: any = { tenantId };

    if (search) {
      query.$text = { $search: search };
    }

    // Lọc theo thương hiệu
    if (brand) {
      const brandDoc = await Brand.findOne({ name: { $regex: `^${brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, tenantId });
      if (brandDoc) {
        query.brandId = brandDoc._id;
      } else {
        return { items: [], total: 0, page, totalPages: 0 };
      }
    }

    // Lọc theo tồn kho
    if (stock === 'inStock') {
      query.quantityInStock = { $gt: 0 };
    } else if (stock === 'lowStock') {
      query.quantityInStock = { $gt: 0, $lt: 10 };
    } else if (stock === 'outOfStock') {
      query.quantityInStock = 0;
    }

    // Lọc theo tag (case-insensitive slug & name)
    if (tag && tag !== 'all') {
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagDoc = await Tag.findOne({ tenantId, $or: [{ slug: { $regex: `^${escapedTag}$`, $options: 'i' } }, { name: { $regex: `^${escapedTag}$`, $options: 'i' } }] });
      if (tagDoc) {
        const productLinks = await ProductTag.find({ tagId: tagDoc._id, tenantId }).lean();
        const productIds = productLinks.map(l => l.productId);
        if (productIds.length === 0) {
          return { items: [], total: 0, page, totalPages: 0 };
        }
        if (query._id) {
          // Nếu đã có _id filter (từ brand), merge
          const existingIds = query._id.$in ? query._id.$in : [query._id];
          query._id = { $in: existingIds.filter((id: any) => productIds.some((pid: any) => pid.equals(id))) };
        } else {
          query._id = { $in: productIds };
        }
      } else {
        return { items: [], total: 0, page, totalPages: 0 };
      }
    }

    // Lọc theo danh mục (match cả format mới `categories[]` và cũ `categoryId`)
    if (category) {
      const categoryDoc = await Category.findOne({ name: { $regex: `^${category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, tenantId });
      if (categoryDoc) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { categories: categoryDoc._id },
            { categoryId: categoryDoc._id },
          ]
        });
      } else {
        return { items: [], total: 0, page, totalPages: 0 };
      }
    }

    // Sắp xếp
    let sort: any = { createdAt: -1 };
    switch (sortBy) {
      case 'priceAsc': sort = { price: 1 }; break;
      case 'priceDesc': sort = { price: -1 }; break;
      case 'stockAsc': sort = { quantityInStock: 1 }; break;
      case 'stockDesc': sort = { quantityInStock: -1 }; break;
      case 'rating': sort = { rating: -1, reviewsCount: -1 }; break;
      case 'newest': sort = { createdAt: -1 }; break;
      case 'bestSeller': sort = { soldCount: -1, createdAt: -1 }; break;
    }

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate('brandId')
      .populate('categories')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const items = await formatMultipleProducts(products, tenantId);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lấy nhiều sản phẩm theo danh sách IDs (bulk fetch cho AI Chat)
   */
  static async getBulkProducts(tenantId: string, ids: string[]): Promise<any[]> {
    if (!ids.length) return [];

    const validIds = ids
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .slice(0, 20)
      .map(id => new mongoose.Types.ObjectId(id));

    if (!validIds.length) return [];

    const productsRaw = await Product.find({ _id: { $in: validIds }, tenantId })
      .populate('brandId')
      .populate('categories')
      .lean();

    return formatMultipleProducts(productsRaw, tenantId);
  }

  /**
   * Gợi ý sản phẩm cho Navbar search (autocomplete lightweight)
   */
  static async suggestProducts(tenantId: string, query: string, limit: number = 8): Promise<any[]> {
    if (!query || !query.trim()) {
      // Return random products when no query
      const randomProducts = await Product.aggregate([
        { $match: { tenantId } },
        { $sample: { size: limit } },
        { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brand' } },
        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, price: 1, image: 1, brand: '$brand.name' } },
      ]);
      return randomProducts.map(p => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        image: p.image || '',
        brand: p.brand || '',
      }));
    }

    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cacheKey = `products:suggest:${tenantId}:${escaped.toLowerCase()}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn('Redis error in suggestProducts:', err);
    }

    // Find matching brand IDs for brand name search
    const matchingBrands = await Brand.find({
      tenantId,
      name: { $regex: `^${escaped}`, $options: 'i' }
    }).select('_id').lean();
    const brandIds = matchingBrands.map(b => b._id);

    const productsRaw = await Product.find({
      tenantId,
      $or: [
        { name: { $regex: `^${escaped}`, $options: 'i' } },
        { brandId: { $in: brandIds } },
      ]
    })
      .populate('brandId', 'name')
      .select('name price image brandId')
      .limit(limit)
      .lean();

    const result = productsRaw.map(p => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      image: p.image || '',
      brand: (p.brandId as any)?.name || '',
    }));

    if (result.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
      } catch (err) {
        console.warn('Redis set error in suggestProducts:', err);
      }
    }

    return result;
  }

  /**
   * Lấy chi tiết một sản phẩm
   */
  static async getProductById(id: string, tenantId: string): Promise<any | null> {
    const product = await Product.findOne({ _id: id, tenantId })
      .populate('brandId')
      .populate('categories')
      .lean();

    if (!product) return null;

    const images = await ProductImage.find({ productId: id, tenantId }).lean();
    const variantIds = (product.variants || []) as mongoose.Types.ObjectId[];
    const variants = variantIds.length > 0
      ? await ProductVariant.find({ _id: { $in: variantIds }, tenantId }).sort({ sortOrder: 1 }).lean()
      : [];

    // Fetch taxonomy terms qua bảng trung gian
    const terms = await ProductTaxonomyTermService.getTermsForProduct(id, tenantId);

    // Fetch tags qua bảng trung gian ProductTag
    const tagLinks = await ProductTag.find({ productId: id, tenantId })
      .populate({ path: 'tagId', model: 'Tag', select: 'name slug' })
      .lean();
    const tagSlugs = tagLinks.map(l => (l.tagId as any)?.slug).filter(Boolean);

    // Fetch SEO and AI reports from ProductSEO
    let seoData: any = {};
    try {
      const { ProductSEO } = await import('../../models/ProductSEO.ts');
      let seoDoc = await ProductSEO.findOne({ productId: new mongoose.Types.ObjectId(id), tenantId }).lean();
      if (!seoDoc) {
        seoDoc = await ProductSEO.findOneAndUpdate(
          { productId: new mongoose.Types.ObjectId(id), tenantId },
          {
            $set: {
              slug: product.name ? slugify(product.name) : '',
              metaTitle: product.name || '',
              metaDescription: '',
              keywords: [],
              priceReport: '',
              sizeReport: '',
              discountReport: '',
            },
            $setOnInsert: { tenantId, productId: new mongoose.Types.ObjectId(id) }
          },
          { upsert: true, new: true }
        ).lean();
      } else {
        const updates: Record<string, any> = {};
        if (!seoDoc.metaTitle && product.name) updates.metaTitle = product.name;
        if (!seoDoc.slug && product.name) updates.slug = slugify(product.name);
        if (Object.keys(updates).length > 0) {
          await ProductSEO.updateOne({ _id: seoDoc._id }, { $set: updates });
          Object.assign(seoDoc, updates);
        }
      }
      seoData = {
        metaTitle: seoDoc.metaTitle || '',
        metaDescription: seoDoc.metaDescription || '',
        keywords: seoDoc.keywords || [],
        slug: seoDoc.slug || '',
        priceReport: seoDoc.priceReport || '',
        sizeReport: seoDoc.sizeReport || '',
        discountReport: seoDoc.discountReport || '',
      };
    } catch (err) {
      console.error('Failed to fetch ProductSEO in getProductById:', err);
    }

    // Fallback: resolve old singular categoryId for pre-migration products
    let oldCatName = '';
    if (!(product.categories as any[])?.length) {
      const oldCatId = (product as any).categoryId;
      if (oldCatId) {
        try {
          const catDoc = await Category.findById(oldCatId).lean();
          if (catDoc) oldCatName = catDoc.name;
        } catch (_) {}
      }
    }

    return {
      ...product,
      brand: (product.brandId as any)?.name || '',
      categories: resolveCategoryNames(product, terms, oldCatName),
      image: images[0]?.url || '',
      images: images.slice(1).map(img => img.url),
      size: variants.map(v => `${v.size}:${v.price}`).join(', '),
      tag: tagSlugs.join(', '),
      scentGroup: terms.scent_group.map((t: any) => t?.name).filter(Boolean).join(', '),
      concentration: terms.concentration.map((t: any) => t?.name).filter(Boolean).join(', '),
      segment: terms.segment.map((t: any) => t?.name).filter(Boolean).join(', '),
      quantityInStock: variants.reduce((sum, v) => sum + (v.quantityInStock || 0), 0) || product.quantityInStock,
      ...seoData
    };
  }
}