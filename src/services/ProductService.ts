import { Product } from '../models/Product.ts';
import type { IProduct } from '../models/Product.ts';
import { redis } from '../config/redis.ts';
import { Brand } from '../models/Brand.ts';
import { Tag } from '../models/Tag.ts';
import { ProductImage } from '../models/ProductImage.ts';
import { ProductVariant } from '../models/ProductVariant.ts';
import { ProductTaxonomy } from '../models/ProductTaxonomy.ts';
import { ImageService } from './ImageService.ts';

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

// Helper to find or create taxonomy
async function findOrCreateTaxonomy(
  name: string,
  type: 'segment' | 'scent_group' | 'concentration',
  tenantId: string
): Promise<any> {
  const slug = slugify(name);
  let taxonomy = await ProductTaxonomy.findOne({ tenantId, type, slug });
  if (!taxonomy) {
    taxonomy = await ProductTaxonomy.create({
      tenantId,
      type,
      name,
      slug,
      status: 'active'
    });
  }
  return taxonomy._id;
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

    // Fetch variants in bulk
    const variants = await ProductVariant.find({ productId: { $in: productIds }, tenantId }).sort({ sortOrder: 1 }).lean();
    const variantMap = new Map<string, string[]>();
    for (const v of variants) {
      const pId = v.productId.toString();
      if (!variantMap.has(pId)) {
        variantMap.set(pId, []);
      }
      variantMap.get(pId)!.push(`${v.size}:${v.price}`);
    }

    return products.map(product => {
      const pId = product._id.toString();
      const productImages = imageMap.get(pId) || [];
      const productVariants = variantMap.get(pId) || [];
      
      return {
        ...product,
        brand: (product.brandId as any)?.name || '',
        image: productImages[0] || '',
        images: productImages.slice(1),
        size: productVariants.join(', '),
        tag: (product.tags as any[])?.map(t => t.slug).join(', ') || '',
        quantityInStock: variants
          .filter(v => v.productId.toString() === pId)
          .reduce((sum, v) => sum + (v.quantityInStock || 0), 0) || product.quantityInStock
      };
    });
  }

  /**
   * Lấy danh sách sản phẩm mới nhất
   */
  static async getNewProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:new:tag:${tenantId}`;
    
    // 1. Thử lấy từ Cache Redis
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Redis error in getNewProducts:', err);
    }

    // Find the tag ID for 'new'
    const tags = await Tag.find({
      tenantId,
      slug: { $in: ['new', 'san-pham-moi'] }
    }).lean();
    const tagIds = tags.map(t => t._id);

    // 2. Nếu không có cache, lấy từ DB
    const query: any = { tenantId };
    if (tagIds.length > 0) {
      query.tags = { $in: tagIds };
    }

    const productsRaw = await Product.find(query)
      .populate('brandId')
      .populate('tags')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

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
   * Lấy danh sách sản phẩm giảm giá (tag: 'Sale')
   */
  static async getSaleProducts(tenantId: string): Promise<any[]> {
    const cacheKey = `products:sale:tag:${tenantId}`;
    
    // 1. Thử lấy từ Cache Redis
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Redis error in getSaleProducts:', err);
    }

    // Find the tag ID for 'sale'
    const tags = await Tag.find({
      tenantId,
      slug: { $in: ['sale', 'giam-gia'] }
    }).lean();
    const tagIds = tags.map(t => t._id);

    // 2. Nếu không có cache, lấy từ DB
    const now = new Date();
    
    const queryBase: any = {
      tenantId,
      discountPercentage: { $gt: 0 }
    };
    if (tagIds.length > 0) {
      queryBase.tags = { $in: tagIds };
    }

    // Tìm sản phẩm giảm giá có thời gian kết thúc gần nhất trong tương lai
    const upcomingSale = await Product.findOne({
      ...queryBase,
      discountEndDate: { $gt: now }
    }).sort({ discountEndDate: 1 });

    let productsRaw = [];

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
   * Lấy tất cả sản phẩm của tenant
   */
  static async getAllProducts(tenantId: string): Promise<any[]> {
    const products = await Product.find({ tenantId })
      .populate('brandId')
      .populate('tags')
      .sort({ createdAt: -1 })
      .lean();

    return await this.formatMultipleProducts(products, tenantId);
  }

  /**
   * Lấy chi tiết một sản phẩm
   */
  static async getProductById(id: string, tenantId: string): Promise<any | null> {
    const product = await Product.findOne({ _id: id, tenantId })
      .populate('brandId')
      .populate('tags')
      .populate('scentGroups')
      .populate('concentrations')
      .populate('segments')
      .lean();
    
    if (!product) return null;

    const images = await ProductImage.find({ productId: id, tenantId }).lean();
    const variants = await ProductVariant.find({ productId: id, tenantId }).sort({ sortOrder: 1 }).lean();

    // Fetch SEO and AI reports from ProductSEO
    let seoData: any = {};
    try {
      const { ProductSEO } = await import('../models/ProductSEO.ts');
      const seoDoc = await ProductSEO.findOne({ productId: id, tenantId }).lean();
      if (seoDoc) {
        seoData = {
          metaTitle: seoDoc.metaTitle || '',
          metaDescription: seoDoc.metaDescription || '',
          keywords: seoDoc.keywords || [],
          priceReport: seoDoc.priceReport || '',
          sizeReport: seoDoc.sizeReport || '',
          discountReport: seoDoc.discountReport || '',
        };
      }
    } catch (err) {
      console.error('Failed to fetch ProductSEO in getProductById:', err);
    }

    return {
      ...product,
      brand: (product.brandId as any)?.name || '',
      image: images[0]?.url || '',
      images: images.slice(1).map(img => img.url),
      size: variants.map(v => `${v.size}:${v.price}`).join(', '),
      tag: (product.tags as any[])?.map(t => t.slug).join(', ') || '',
      scentGroup: (product.scentGroups as any[])?.map(s => s.name).join(', ') || '',
      concentration: (product.concentrations as any[])?.map(c => c.name).join(', ') || '',
      segment: (product.segments as any[])?.map(s => s.name).join(', ') || '',
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

    // Brand mapping
    if (data.brand) {
      let brandDoc = await Brand.findOne({ name: data.brand, tenantId });
      if (!brandDoc) {
        brandDoc = await Brand.create({ name: data.brand, status: 'active', tenantId });
      }
      updateData.brandId = brandDoc._id;
    }

    // Tags mapping
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
      updateData.tags = tagIds;
    }

    // Taxonomy mapping (scentGroup, concentration, segment)
    if (data.scentGroup !== undefined) {
      const scentNames = data.scentGroup.split(',').map((s: string) => s.trim()).filter(Boolean);
      const scentIds = [];
      for (const name of scentNames) {
        const id = await findOrCreateTaxonomy(name, 'scent_group', tenantId);
        scentIds.push(id);
      }
      updateData.scentGroups = scentIds;
    }
    if (data.concentration !== undefined) {
      const concNames = data.concentration.split(',').map((s: string) => s.trim()).filter(Boolean);
      const concIds = [];
      for (const name of concNames) {
        const id = await findOrCreateTaxonomy(name, 'concentration', tenantId);
        concIds.push(id);
      }
      updateData.concentrations = concIds;
    }
    if (data.segment !== undefined) {
      const segNames = data.segment.split(',').map((s: string) => s.trim()).filter(Boolean);
      const segIds = [];
      for (const name of segNames) {
        const id = await findOrCreateTaxonomy(name, 'segment', tenantId);
        segIds.push(id);
      }
      updateData.segments = segIds;
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
        allImages.push(...data.images.filter(img => img !== data.image));
      }
      if (allImages.length > 0) {
        await ProductImage.deleteMany({ productId: id, tenantId });
        await ProductImage.insertMany(allImages.map(url => ({
          productId: id,
          tenantId,
          url
        })));
      }

      // Sync Variants in ProductVariant collection
      if (data.size !== undefined) {
        await ProductVariant.deleteMany({ productId: id, tenantId });
        const parsed = parseSizes(data.size);
        if (parsed.length > 0) {
          const variantsToInsert = parsed.map((item, index) => ({
            productId: id,
            tenantId,
            size: item.size,
            price: item.price,
            quantityInStock: index === 0 ? (data.quantityInStock || 0) : 0,
            isDefault: index === 0,
            sortOrder: index
          }));
          await ProductVariant.insertMany(variantsToInsert);
        }
      }

      // Sync ProductSEO
      try {
        const { ProductSEO } = await import('../models/ProductSEO.ts');
        const seoData: any = {};
        if (data.metaTitle !== undefined) seoData.metaTitle = data.metaTitle;
        if (data.metaDescription !== undefined) seoData.metaDescription = data.metaDescription;
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
            { productId: id, tenantId },
            { 
              $set: seoData,
              $setOnInsert: { productId: id, tenantId }
            },
            { upsert: true, new: true }
          );
        }
      } catch (err) {
        console.error('Failed to save ProductSEO in updateProduct:', err);
      }

      // Xóa các cache liên quan sau khi cập nhật
      await redis.del(`products:new:tag:${tenantId}`);
      await redis.del(`products:sale:tag:${tenantId}`);
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

    const result = await Product.deleteOne({ _id: id, tenantId });
    if (result.deletedCount > 0) {
      // Clean normalized collections
      await ProductImage.deleteMany({ productId: id, tenantId });
      await ProductVariant.deleteMany({ productId: id, tenantId });

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
        await redis.del(`products:sale:tag:${tenantId}`);
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
    
    const result = await Product.deleteMany({ _id: { $in: ids }, tenantId });
    if (result.deletedCount > 0) {
      // Clean normalized collections in bulk
      await ProductImage.deleteMany({ productId: { $in: ids }, tenantId });
      await ProductVariant.deleteMany({ productId: { $in: ids }, tenantId });

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
        await redis.del(`products:sale:tag:${tenantId}`);
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
    if (data.keywords !== undefined) productData.keywords = data.keywords;

    // Brand mapping
    if (data.brand) {
      let brandDoc = await Brand.findOne({ name: data.brand, tenantId });
      if (!brandDoc) {
        brandDoc = await Brand.create({ name: data.brand, status: 'active', tenantId });
      }
      productData.brandId = brandDoc._id;
    }

    // Tags mapping
    if (data.tag) {
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
      productData.tags = tagIds;
    }

    // Taxonomy mapping
    if (data.scentGroup) {
      const scentNames = data.scentGroup.split(',').map((s: string) => s.trim()).filter(Boolean);
      const scentIds = [];
      for (const name of scentNames) {
        const id = await findOrCreateTaxonomy(name, 'scent_group', tenantId);
        scentIds.push(id);
      }
      productData.scentGroups = scentIds;
    }
    if (data.concentration) {
      const concNames = data.concentration.split(',').map((s: string) => s.trim()).filter(Boolean);
      const concIds = [];
      for (const name of concNames) {
        const id = await findOrCreateTaxonomy(name, 'concentration', tenantId);
        concIds.push(id);
      }
      productData.concentrations = concIds;
    }
    if (data.segment) {
      const segNames = data.segment.split(',').map((s: string) => s.trim()).filter(Boolean);
      const segIds = [];
      for (const name of segNames) {
        const id = await findOrCreateTaxonomy(name, 'segment', tenantId);
        segIds.push(id);
      }
      productData.segments = segIds;
    }

    const product = new Product(productData);
    const saved = await product.save();

    // Size / Variants mapping
    if (data.size) {
      const parsed = parseSizes(data.size);
      if (parsed.length > 0) {
        const variantsToInsert = parsed.map((item, index) => ({
          productId: saved._id,
          tenantId,
          size: item.size,
          price: item.price,
          quantityInStock: index === 0 ? (data.quantityInStock || 0) : 0,
          isDefault: index === 0,
          sortOrder: index
        }));
        await ProductVariant.insertMany(variantsToInsert);
      }
    }

    // Images mapping
    const allImages = [];
    if (data.image) allImages.push(data.image);
    if (data.images && Array.isArray(data.images)) {
      allImages.push(...data.images.filter(img => img !== data.image));
    }
    if (allImages.length > 0) {
      await ProductImage.insertMany(allImages.map(url => ({
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
            metaTitle: data.metaTitle,
            metaDescription: data.metaDescription,
            keywords: keywordsArray,
            priceReport: data.priceReport,
            sizeReport: data.sizeReport,
            discountReport: data.discountReport,
          },
          $setOnInsert: { productId: saved._id, tenantId }
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Failed to save ProductSEO in createProduct:', err);
    }

    // Clear Redis Cache so that the new product immediately shows up on the homepage/outside!
    try {
      await redis.del(`products:new:tag:${tenantId}`);
      await redis.del(`products:sale:tag:${tenantId}`);
    } catch (err) {
      console.warn('Failed to clear product caches on creation:', err);
    }
    
    return saved;
  }
}
