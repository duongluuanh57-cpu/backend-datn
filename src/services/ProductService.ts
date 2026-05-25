import mongoose from 'mongoose';
import { Product } from '../models/Product.ts';
import { redis } from '../config/redis.ts';
import { Brand } from '../models/Brand.ts';
import { Tag } from '../models/Tag.ts';
import { ProductTag } from '../models/ProductTag.ts';
import { ProductImage } from '../models/ProductImage.ts';
import { ProductVariant } from '../models/ProductVariant.ts';
import { ImageService } from './ImageService.ts';
import { TaxonomyTermService, ProductTaxonomyTermService } from './TaxonomyTermService.ts';

// Helper slugification
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper sizes parsing
function parseSizes(sizeStr: string): { size: string; price: number }[] {
  if (!sizeStr) return [];
  return sizeStr.split(',').map(s => {
    const parts = s.trim().split(':');
    const sizeName = parts[0]?.trim();
    const priceVal = parseInt(parts[1]?.trim() || '0', 10);
    return { size: sizeName, price: priceVal };
  }).filter(item => item.size);
}

// Helper to find taxonomy term by name — delegates to TaxonomyTermService
async function findTaxonomyOnly(
  name: string,
  type: 'segment' | 'scent_group' | 'concentration',
  tenantId: string
): Promise<any | null> {
  return TaxonomyTermService.findByName(name, type, tenantId);
}

export class ProductService {
  private static CACHE_TTL = 300; // 5 minutes

  /**
   * Format multiple product raw lean documents into frontend-friendly flat objects
   */
  private static async formatMultipleProducts(products: any[], tenantId: string): Promise<any[]> {
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
    const { ProductTaxonomyTerm } = await import('../models/ProductTaxonomyTerm.ts');
    const termLinks = await ProductTaxonomyTerm.find({ productId: { $in: productIds }, tenantId })
      .populate({ path: 'termId', model: 'TaxonomyTerm', select: 'name slug' })
      .populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug' })
      .lean();

    // Build productId -> { scent_group: [], concentration: [], segment: [] }
    const termMap = new Map<string, Record<string, any[]>>();
    for (const link of termLinks) {
      const pId = (link.productId as any).toString();
      if (!termMap.has(pId)) {
        termMap.set(pId, { scent_group: [], concentration: [], segment: [] });
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
    const { ProductSEO } = await import('../models/ProductSEO.ts');
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

    return products.map(product => {
      const pId = product._id.toString();
      const productImages = imageMap.get(pId) || [];
      const terms = termMap.get(pId) || { scent_group: [], concentration: [], segment: [] };
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
        quantityInStock: productVariants.reduce((sum: number, v: any) => sum + (v.quantityInStock || 0), 0) || product.quantityInStock
      };
    });
  }

  /**
   * Helper: lấy productIds có tag theo slug list
   */
  private static async getProductIdsByTagSlugs(slugs: string[], tenantId: string): Promise<mongoose.Types.ObjectId[]> {
    const tags = await Tag.find({ tenantId, slug: { $in: slugs } }).lean();
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
      .sort({ createdAt: -1 })
      .lean();

    const products = await this.formatMultipleProducts(productsRaw, tenantId);

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
      .sort({ createdAt: -1 })
      .lean();

    const products = await this.formatMultipleProducts(productsRaw, tenantId);

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
      .sort({ createdAt: -1 })
      .lean();

    const products = await this.formatMultipleProducts(productsRaw, tenantId);

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
      discountPercentage: { $gt: 0 }
    };
    if (saleProductIds.length > 0) queryBase._id = { $in: saleProductIds };

    // Tìm sản phẩm giảm giá có thời gian kết thúc gần nhất trong tương lai
    const upcomingSale = await Product.findOne({
      ...queryBase,
      discountEndDate: { $gt: now }
    }).sort({ discountEndDate: 1 });

    let productsRaw: any[] = [];

    if (upcomingSale && upcomingSale.discountEndDate) {
      const targetEndDate = upcomingSale.discountEndDate;
      // Chỉ lấy các sản phẩm có cùng thời gian kết thúc giảm giá này
      productsRaw = await Product.find({
        ...queryBase,
        discountEndDate: targetEndDate,
        $or: [
          { discountStartDate: null },
          { discountStartDate: { $exists: false } },
          { discountStartDate: { $lte: now } }
        ]
      })
        .populate('brandId')
        .populate('tags')
        .sort({ createdAt: -1 })
        .limit(4)
        .lean();
    } else {
      // Nếu không có sản phẩm nào có hạn giảm giá tương lai, trả về danh sách rỗng
      productsRaw = [];
    }

    const products = await this.formatMultipleProducts(productsRaw, tenantId);

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
      sortBy?: string;
    } = {}
  ): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 25, search, brand, stock, tag, sortBy } = options;

    const query: any = { tenantId };

    // Tìm kiếm theo tên hoặc mô tả
    if (search) {
      query.$or = [
        { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { description: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ];
    }

    // Lọc theo thương hiệu
    if (brand) {
      const brandDoc = await Brand.findOne({ name: { $regex: `^\\s*${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, $options: 'i' }, tenantId });
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
          query._id = { $in: existingIds.filter(id => productIds.some(pid => pid.equals(id))) };
        } else {
          query._id = { $in: productIds };
        }
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
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const items = await this.formatMultipleProducts(products, tenantId);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lấy chi tiết một sản phẩm
   */
  static async getProductById(id: string, tenantId: string): Promise<any | null> {
    const product = await Product.findOne({ _id: id, tenantId })
      .populate('brandId')
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
      const { ProductSEO } = await import('../models/ProductSEO.ts');
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

    return {
      ...product,
      brand: (product.brandId as any)?.name || '',
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

  /**
   * Cập nhật sản phẩm
   */
  static async updateProduct(id: string, data: any, tenantId: string): Promise<any | null> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.reviewsCount !== undefined) updateData.reviewsCount = data.reviewsCount;
    if (data.quantityInStock !== undefined) updateData.quantityInStock = data.quantityInStock;
    if (data.discountPercentage !== undefined) updateData.discountPercentage = data.discountPercentage;
    if (data.discountStartDate !== undefined) updateData.discountStartDate = data.discountStartDate;
    if (data.discountEndDate !== undefined) updateData.discountEndDate = data.discountEndDate;
    if (data.keywords !== undefined) updateData.keywords = data.keywords;

    // Brand mapping - chỉ tìm, KHÔNG tạo mới (case-insensitive, bỏ qua khoảng trắng thừa)
    if (data.brand) {
      const brandNameRegex = new RegExp(`^\\s*${data.brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
      const brandDoc = await Brand.findOne({ name: brandNameRegex, tenantId });
      if (brandDoc) {
        updateData.brandId = brandDoc._id;
      } else {
        console.warn(`⚠️ [Brand] "${data.brand}" not found in DB - skipping, will NOT create`);
      }
    }

    // Tags mapping — ghi vào bảng trung gian ProductTag
    if (data.tag !== undefined) {
      const tagSlugs = data.tag.split(',').map((s: string) => s.trim()).filter(Boolean);
      const tagIds = [];
      for (const slug of tagSlugs) {
        let tagDoc = await Tag.findOne({ slug, tenantId });
        if (!tagDoc) {
          const name = slug.charAt(0).toUpperCase() + slug.slice(1);
          tagDoc = await Tag.create({ name, slug, status: 'active', tenantId });
        }
        tagIds.push(tagDoc._id);
      }
      // Xóa tags cũ rồi insert lại
      await ProductTag.deleteMany({ productId: id, tenantId });
      if (tagIds.length > 0) {
        await ProductTag.insertMany(tagIds.map(tagId => ({ productId: id, tagId, tenantId })));
      }
    }

    // Taxonomy mapping — ghi vào bảng trung gian ProductTaxonomyTerm
    if (data.scentGroup !== undefined) {
      const scentNames = data.scentGroup.split(',').map((s: string) => s.trim()).filter(Boolean);
      const scentIds = (await Promise.all(scentNames.map((n: string) => findTaxonomyOnly(n, 'scent_group', tenantId)))).filter(Boolean);
      await ProductTaxonomyTermService.setTermsForProduct(id, 'scent_group', scentIds, tenantId);
    }
    if (data.concentration !== undefined) {
      const concNames = data.concentration.split(',').map((s: string) => s.trim()).filter(Boolean);
      const concIds = (await Promise.all(concNames.map((n: string) => findTaxonomyOnly(n, 'concentration', tenantId)))).filter(Boolean);
      await ProductTaxonomyTermService.setTermsForProduct(id, 'concentration', concIds, tenantId);
    }
    if (data.segment !== undefined) {
      const segNames = data.segment.split(',').map((s: string) => s.trim()).filter(Boolean);
      const segIds = (await Promise.all(segNames.map((n: string) => findTaxonomyOnly(n, 'segment', tenantId)))).filter(Boolean);
      await ProductTaxonomyTermService.setTermsForProduct(id, 'segment', segIds, tenantId);
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updateData },
      { new: true }
    );

    if (updatedProduct) {
      // Sync Images in ProductImage collection
      const allImages = [];
      if (data.image) allImages.push(data.image);
      if (data.images && Array.isArray(data.images)) {
        allImages.push(...data.images.filter((img: string) => img !== data.image));
      }
      if (allImages.length > 0) {
        await ProductImage.deleteMany({ productId: id, tenantId });
        await ProductImage.insertMany(allImages.map((img: string) => ({
          productId: id,
          tenantId,
          url: img
        })));
      }

      // Sync Variants in ProductVariant collection
      if (data.size !== undefined) {
        // Delete old variants referenced by this product
        const existingVariantIds = (updatedProduct.variants || []) as mongoose.Types.ObjectId[];
        if (existingVariantIds.length > 0) {
          await ProductVariant.deleteMany({ _id: { $in: existingVariantIds }, tenantId });
        }

        const parsed = parseSizes(data.size);
        if (parsed.length > 0) {
          const variantsToInsert = parsed.map((item, index) => ({
            tenantId,
            productId: id,
            size: item.size,
            price: item.price,
            quantityInStock: index === 0 ? (data.quantityInStock || 0) : 0,
            isDefault: index === 0,
            sortOrder: index
          }));
          const insertedVariants = await ProductVariant.insertMany(variantsToInsert);
          const newVariantIds = insertedVariants.map(v => v._id);
          await Product.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: { variants: newVariantIds } }
          );
        } else {
          await Product.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: { variants: [] } }
          );
        }
      }

      // Sync ProductSEO
      try {
        const { ProductSEO } = await import('../models/ProductSEO.ts');
        const seoData: any = {};
        if (data.metaTitle !== undefined) seoData.metaTitle = data.metaTitle;
        if (data.metaDescription !== undefined) seoData.metaDescription = data.metaDescription;
        if (data.slug !== undefined) seoData.slug = data.slug;
        if (data.keywords !== undefined) {
          seoData.keywords = Array.isArray(data.keywords)
            ? data.keywords
            : typeof data.keywords === 'string'
              ? data.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
              : [];
        }
        if (data.priceReport !== undefined) seoData.priceReport = data.priceReport;
        if (data.sizeReport !== undefined) seoData.sizeReport = data.sizeReport;
        if (data.discountReport !== undefined) seoData.discountReport = data.discountReport;

        if (Object.keys(seoData).length > 0) {
          await ProductSEO.findOneAndUpdate(
            { productId: new mongoose.Types.ObjectId(id), tenantId },
            { $set: seoData, $setOnInsert: { tenantId, productId: new mongoose.Types.ObjectId(id) } },
            { upsert: true, new: true }
          );
        }
      } catch (err) {
        console.error('Failed to save ProductSEO in updateProduct:', err);
      }

      // Xóa các cache liên quan sau khi cập nhật
      await redis.del(`products:new:tag:${tenantId}`);
      await redis.del(`products:new:tag:v3:${tenantId}`);
      await redis.del(`products:limited:tag:v2:${tenantId}`);
      await redis.del(`products:sale:tag:${tenantId}`);
      await redis.del(`products:trending:tag:${tenantId}`);
      await redis.del(`products:trending:tag:v3:${tenantId}`);
      await redis.del(`products:${id}:${tenantId}`);
    }

    return updatedProduct;
  }

  /**
   * Xóa sản phẩm
   */
  static async deleteProduct(id: string, tenantId: string): Promise<boolean> {
    const product = await Product.findOne({ _id: id, tenantId });
    if (!product) return false;

    // Fetch images before deletion from DB
    const images = await ProductImage.find({ productId: id, tenantId }).lean();
    const variantIds = (product.variants || []) as mongoose.Types.ObjectId[];

    const result = await Product.deleteOne({ _id: id, tenantId });
    if (result.deletedCount > 0) {
      // Clean normalized collections
      await ProductImage.deleteMany({ productId: id, tenantId });
      if (variantIds.length > 0) {
        await ProductVariant.deleteMany({ _id: { $in: variantIds }, tenantId });
      }
      // Xóa taxonomy term links
      await ProductTaxonomyTermService.deleteAllForProduct(id, tenantId);
      // Xóa tag links
      await ProductTag.deleteMany({ productId: id, tenantId });
      // Delete SEO doc
      try {
        const { ProductSEO } = await import('../models/ProductSEO.ts');
        await ProductSEO.deleteOne({ productId: id, tenantId });
      } catch (err) {
        console.warn('Failed to delete ProductSEO in deleteProduct:', err);
      }

      // Delete images and virtual folder from R2
      const foldersToDelete = new Set<string>();
      for (const img of images) {
        ImageService.deleteFromR2(img.url).catch(err => {
          console.error('Lỗi khi xóa ảnh khỏi R2 trong deleteProduct:', err);
        });
        const folder = ImageService.getFolderFromUrl(img.url);
        if (folder) {
          foldersToDelete.add(folder);
        }
      }
      if (product.name) {
        foldersToDelete.add(`products/${slugify(product.name)}`);
      }
      for (const folder of foldersToDelete) {
        ImageService.deleteFolderFromR2(folder).catch(err => {
          console.error('Lỗi khi xóa folder trên R2 trong deleteProduct:', err);
        });
      }

      try {
        await redis.del(`products:new:tag:${tenantId}`);
        await redis.del(`products:new:tag:v3:${tenantId}`);
        await redis.del(`products:limited:tag:v2:${tenantId}`);
        await redis.del(`products:sale:tag:${tenantId}`);
        await redis.del(`products:trending:tag:${tenantId}`);
        await redis.del(`products:trending:tag:v3:${tenantId}`);
        await redis.del(`products:${id}:${tenantId}`);
      } catch (err) {
        console.warn('Failed to clear product caches on deletion:', err);
      }
    }
    return result.deletedCount > 0;
  }

  /**
   * Xóa hàng loạt sản phẩm
   */
  static async bulkDeleteProducts(ids: string[], tenantId: string): Promise<boolean> {
    if (!ids || ids.length === 0) return false;

    // Fetch products and images before deletion from DB
    const products = await Product.find({ _id: { $in: ids }, tenantId }).lean();
    const images = await ProductImage.find({ productId: { $in: ids }, tenantId }).lean();
    const allVariantIds = products.flatMap(p => (p.variants || []) as mongoose.Types.ObjectId[]);

    const result = await Product.deleteMany({ _id: { $in: ids }, tenantId });
    if (result.deletedCount > 0) {
      // Clean normalized collections in bulk
      await ProductImage.deleteMany({ productId: { $in: ids }, tenantId });
      if (allVariantIds.length > 0) {
        await ProductVariant.deleteMany({ _id: { $in: allVariantIds }, tenantId });
      }
      // Xóa taxonomy term links
      await ProductTaxonomyTermService.deleteAllForProducts(ids, tenantId);
      // Xóa tag links
      await ProductTag.deleteMany({ productId: { $in: ids }, tenantId });
      // Delete SEO docs
      try {
        const { ProductSEO } = await import('../models/ProductSEO.ts');
        await ProductSEO.deleteMany({ productId: { $in: ids }, tenantId });
      } catch (err) {
        console.warn('Failed to delete ProductSEO in bulkDeleteProducts:', err);
      }

      // Delete images and virtual folders from R2
      const foldersToDelete = new Set<string>();
      for (const img of images) {
        ImageService.deleteFromR2(img.url).catch(err => {
          console.error('Lỗi khi xóa ảnh khỏi R2 trong bulkDeleteProducts:', err);
        });
        const folder = ImageService.getFolderFromUrl(img.url);
        if (folder) {
          foldersToDelete.add(folder);
        }
      }
      for (const p of products) {
        if (p.name) {
          foldersToDelete.add(`products/${slugify(p.name)}`);
        }
      }
      for (const folder of foldersToDelete) {
        ImageService.deleteFolderFromR2(folder).catch(err => {
          console.error('Lỗi khi xóa folder trên R2 trong bulkDeleteProducts:', err);
        });
      }

      try {
        await redis.del(`products:new:tag:${tenantId}`);
        await redis.del(`products:new:tag:v3:${tenantId}`);
        await redis.del(`products:limited:tag:v2:${tenantId}`);
        await redis.del(`products:sale:tag:${tenantId}`);
        await redis.del(`products:trending:tag:${tenantId}`);
        await redis.del(`products:trending:tag:v3:${tenantId}`);
        for (const id of ids) {
          await redis.del(`products:${id}:${tenantId}`);
        }
      } catch (err) {
        console.warn('Failed to clear product caches on bulk deletion:', err);
      }
    }
    return result.deletedCount > 0;
  }

  /**
   * Tạo sản phẩm mới
   */
  static async createProduct(data: any, tenantId: string): Promise<any> {
    const productData: any = { tenantId };
    if (data.name !== undefined) productData.name = data.name;
    if (data.price !== undefined) productData.price = data.price;
    if (data.description !== undefined) productData.description = data.description;
    if (data.gender !== undefined) productData.gender = data.gender;
    if (data.rating !== undefined) productData.rating = data.rating;
    if (data.reviewsCount !== undefined) productData.reviewsCount = data.reviewsCount;
    if (data.quantityInStock !== undefined) productData.quantityInStock = data.quantityInStock;
    if (data.discountPercentage !== undefined) productData.discountPercentage = data.discountPercentage;
    if (data.discountStartDate !== undefined) productData.discountStartDate = data.discountStartDate;
    if (data.discountEndDate !== undefined) productData.discountEndDate = data.discountEndDate;
    if (data.image !== undefined) productData.image = data.image;
    if (data.keywords !== undefined) productData.keywords = data.keywords;

    // Brand mapping - Ưu tiên brandId, fallback sang tên brand (case-insensitive, bỏ qua khoảng trắng thừa)
    if (data.brand) {
      let brandDoc;
      const trimmedBrand = data.brand.trim();

      // Kiểm tra xem có phải là ObjectId hợp lệ không (24 hex characters)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(trimmedBrand);

      if (isValidObjectId) {
        // Tìm theo ID trước (ưu tiên)
        brandDoc = await Brand.findOne({ _id: trimmedBrand, tenantId });
        if (brandDoc) {
          console.log(`🔍 [Brand] Tìm theo ID "${trimmedBrand}" (tenantId: ${tenantId}) → Tìm thấy: "${brandDoc.name}"`);
        } else {
          console.log(`⚠️ [Brand] ID "${trimmedBrand}" không tìm thấy, thử tìm theo tên...`);
        }
      }

      // Nếu không tìm thấy theo ID hoặc không phải ObjectId, tìm theo tên
      if (!brandDoc) {
        // Thử match chính xác trước
        brandDoc = await Brand.findOne({ name: trimmedBrand, tenantId });
        if (!brandDoc) {
          // Fallback: case-insensitive + trim cả 2 bên
          const allBrands = await Brand.find({ tenantId }).lean();
          brandDoc = allBrands.find(b =>
            b.name.trim().toLowerCase() === trimmedBrand.toLowerCase()
          );
        }
        console.log(`🔍 [Brand] Tìm theo tên "${trimmedBrand}" (raw: "${data.brand}") (tenantId: ${tenantId}) → ${brandDoc ? `Tìm thấy: "${brandDoc.name}"` : 'KHÔNG TÌM THẤY'}`);
      }

      if (brandDoc) {
        productData.brandId = brandDoc._id;
      } else {
        throw new Error('Vui lòng kiểm tra lại tên hãng.');
      }
    } else {
      throw new Error('Vui lòng kiểm tra lại tên hãng.');
    }

    // Tags mapping — ghi vào bảng trung gian ProductTag sau khi save
    const pendingTagSlugs: string[] = [];
    if (data.tag) {
      pendingTagSlugs.push(...data.tag.split(',').map((s: string) => s.trim()).filter(Boolean));
    }

    // Taxonomy mapping — ghi vào bảng trung gian ProductTaxonomyTerm sau khi save
    if (data.scentGroup) {
      const scentNames = data.scentGroup.split(',').map((s: string) => s.trim()).filter(Boolean);
      const scentIds = (await Promise.all(scentNames.map((n: string) => findTaxonomyOnly(n, 'scent_group', tenantId)))).filter(Boolean);
      productData._pendingScentIds = scentIds;
    }
    if (data.concentration) {
      const concNames = data.concentration.split(',').map((s: string) => s.trim()).filter(Boolean);
      const concIds = (await Promise.all(concNames.map((n: string) => findTaxonomyOnly(n, 'concentration', tenantId)))).filter(Boolean);
      productData._pendingConcIds = concIds;
    }
    if (data.segment) {
      const segNames = data.segment.split(',').map((s: string) => s.trim()).filter(Boolean);
      const segIds = (await Promise.all(segNames.map((n: string) => findTaxonomyOnly(n, 'segment', tenantId)))).filter(Boolean);
      productData._pendingSegIds = segIds;
    }

    // Tách pending IDs ra trước khi tạo Product
    const pendingScentIds = productData._pendingScentIds || [];
    const pendingConcIds = productData._pendingConcIds || [];
    const pendingSegIds = productData._pendingSegIds || [];
    delete productData._pendingScentIds;
    delete productData._pendingConcIds;
    delete productData._pendingSegIds;

    const product = new Product(productData);
    const saved = await product.save();

    // Ghi taxonomy term links vào bảng trung gian
    await Promise.all([
      pendingScentIds.length > 0 && ProductTaxonomyTermService.setTermsForProduct(saved._id.toString(), 'scent_group', pendingScentIds, tenantId),
      pendingConcIds.length > 0 && ProductTaxonomyTermService.setTermsForProduct(saved._id.toString(), 'concentration', pendingConcIds, tenantId),
      pendingSegIds.length > 0 && ProductTaxonomyTermService.setTermsForProduct(saved._id.toString(), 'segment', pendingSegIds, tenantId),
    ]);

    // Ghi tag links vào bảng trung gian ProductTag
    if (pendingTagSlugs.length > 0) {
      const tagDocs = [];
      for (const slug of pendingTagSlugs) {
        let tagDoc = await Tag.findOne({ slug, tenantId });
        if (!tagDoc) {
          const name = slug.charAt(0).toUpperCase() + slug.slice(1);
          tagDoc = await Tag.create({ name, slug, status: 'active', tenantId });
        }
        tagDocs.push(tagDoc._id);
      }
      await ProductTag.insertMany(tagDocs.map(tagId => ({ productId: saved._id, tagId, tenantId })));
    }

    // Size / Variants mapping
    if (data.size) {
      const parsed = parseSizes(data.size);
      if (parsed.length > 0) {
        const variantsToInsert = parsed.map((item, index) => ({
          tenantId,
          productId: saved._id,
          size: item.size,
          price: item.price,
          quantityInStock: index === 0 ? (data.quantityInStock || 0) : 0,
          isDefault: index === 0,
          sortOrder: index
        }));
        const insertedVariants = await ProductVariant.insertMany(variantsToInsert);
        const variantIds = insertedVariants.map(v => v._id);
        await Product.findOneAndUpdate(
          { _id: saved._id, tenantId },
          { $set: { variants: variantIds } }
        );
      }
    }

    // Images mapping
    const allImages: string[] = [];
    if (data.image) allImages.push(data.image);
    if (data.images && Array.isArray(data.images)) {
      allImages.push(...data.images.filter((img: string) => img !== data.image));
    }
    if (allImages.length > 0) {
      await ProductImage.insertMany(allImages.map((url: string) => ({
        productId: saved._id,
        tenantId,
        url
      })));
    }

    // Sync SEO and reports in ProductSEO collection
    try {
      const { ProductSEO } = await import('../models/ProductSEO.ts');
      const keywordsArray = Array.isArray(data.keywords)
        ? data.keywords
        : typeof data.keywords === 'string'
          ? data.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
          : [];

      await ProductSEO.findOneAndUpdate(
        { productId: saved._id, tenantId },
        {
          $set: {
            metaTitle: data.metaTitle || '',
            metaDescription: data.metaDescription || '',
            slug: data.slug || '',
            keywords: keywordsArray,
            priceReport: data.priceReport || '',
            sizeReport: data.sizeReport || '',
            discountReport: data.discountReport || '',
          },
          $setOnInsert: { tenantId, productId: saved._id }
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Failed to save ProductSEO in createProduct:', err);
    }

    // Clear Redis Cache so that the new product immediately shows up on the homepage/outside!
    try {
      await redis.del(`products:new:tag:${tenantId}`);
      await redis.del(`products:new:tag:v3:${tenantId}`);
      await redis.del(`products:limited:tag:v2:${tenantId}`);
      await redis.del(`products:sale:tag:${tenantId}`);
      await redis.del(`products:trending:tag:${tenantId}`);
      await redis.del(`products:trending:tag:v3:${tenantId}`);
    } catch (err) {
      console.warn('Failed to clear product caches on creation:', err);
    }

    return saved;
  }
}
