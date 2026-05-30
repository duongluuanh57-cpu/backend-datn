import mongoose from 'mongoose';
import { Product } from '../../models/Product.ts';
import { redis } from '../../config/redis.ts';
import { Brand } from '../../models/Brand.ts';
import { Tag } from '../../models/Tag.ts';
import { ProductTag } from '../../models/ProductTag.ts';
import { Category } from '../../models/Category.ts';
import { ProductImage } from '../../models/ProductImage.ts';
import { ProductVariant } from '../../models/ProductVariant.ts';
import { ImageService } from '../ImageService.ts';
import { ProductTaxonomyTermService } from '../TaxonomyTermService.ts';
import { FuzzyMatchCache } from '../FuzzyMatchCache.ts';
import { findTaxonomyOnly, parseSizes, slugify } from './productHelpers.ts';

export class ProductMutationService {

  /**
   * Cập nhật sản phẩm
   */
  static async updateProduct(id: string, data: any, tenantId: string): Promise<any | null> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.reviewsCount !== undefined) updateData.reviewsCount = data.reviewsCount;
    if (data.quantityInStock !== undefined) updateData.quantityInStock = data.quantityInStock;
    if (data.discountPercentage !== undefined) updateData.discountPercentage = data.discountPercentage;
    if (data.discountStartDate !== undefined) updateData.discountStartDate = data.discountStartDate;
    if (data.discountEndDate !== undefined) updateData.discountEndDate = data.discountEndDate;
    if (data.keywords !== undefined) updateData.keywords = data.keywords;

    // Brand mapping - chỉ tìm, KHÔNG tạo mới (case-insensitive, bỏ qua khoảng trắng thừa)
    if (data.brand) {
      let brandDoc;
      const trimmedBrand = data.brand.trim();
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(trimmedBrand);
      if (isValidObjectId) {
        brandDoc = await Brand.findOne({ _id: trimmedBrand, tenantId });
      }
      if (!brandDoc) {
        brandDoc = await Brand.findOne({ name: trimmedBrand, tenantId });
      }
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
      const scentIds = (await Promise.all(scentNames.map((n: string) => findTaxonomyOnly(n, 'scent_group' as any, tenantId)))).filter(Boolean);
      await ProductTaxonomyTermService.setTermsForProduct(id, 'scent_group', scentIds, tenantId);
    }
    if (data.concentration !== undefined) {
      const concNames = data.concentration.split(',').map((s: string) => s.trim()).filter(Boolean);
      const concIds = (await Promise.all(concNames.map((n: string) => findTaxonomyOnly(n, 'concentration' as any, tenantId)))).filter(Boolean);
      await ProductTaxonomyTermService.setTermsForProduct(id, 'concentration', concIds, tenantId);
    }
    if (data.segment !== undefined) {
      const segNames = data.segment.split(',').map((s: string) => s.trim()).filter(Boolean);
      const segIds = (await Promise.all(segNames.map((n: string) => findTaxonomyOnly(n, 'segment' as any, tenantId)))).filter(Boolean);
      await ProductTaxonomyTermService.setTermsForProduct(id, 'segment', segIds, tenantId);
    }
    if (data.categories !== undefined) {
      const catNames = data.categories.split(',').map((s: string) => s.trim()).filter(Boolean);
      const catIds = (await Promise.all(catNames.map(async (n: string) => {
        const cat = await Category.findOne({ name: { $regex: `^${n.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, tenantId });
        return cat?._id || null;
      }))).filter(Boolean);
      if (catIds.length > 0) updateData.categories = catIds;
      else updateData.categories = [];
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
        const { ProductSEO } = await import('../../models/ProductSEO.ts');
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
      await clearProductCache(tenantId);
      try {
        await redis.del(`products:${id}:${tenantId}`);
      } catch (_) {}
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
        const { ProductSEO } = await import('../../models/ProductSEO.ts');
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

      await clearProductCache(tenantId);
      try {
        await redis.del(`products:${id}:${tenantId}`);
      } catch (_) {}
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
        const { ProductSEO } = await import('../../models/ProductSEO.ts');
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

      await clearProductCache(tenantId);
      for (const id of ids) {
        try {
          await redis.del(`products:${id}:${tenantId}`);
        } catch (_) {}
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
        brandDoc = await Brand.findOne({ name: trimmedBrand, tenantId });
        if (!brandDoc) {
          const { lookup } = await FuzzyMatchCache.getOrFetch(
            `brands:${tenantId}:all`,
            () => Brand.find({ tenantId }).lean()
          );
          brandDoc = FuzzyMatchCache.fuzzyFind(trimmedBrand, lookup, (b: any) => b.name);
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
      const scentIds = (await Promise.all(scentNames.map((n: string) => findTaxonomyOnly(n, 'scent_group' as any, tenantId)))).filter(Boolean);
      productData._pendingScentIds = scentIds;
    }
    if (data.concentration) {
      const concNames = data.concentration.split(',').map((s: string) => s.trim()).filter(Boolean);
      const concIds = (await Promise.all(concNames.map((n: string) => findTaxonomyOnly(n, 'concentration' as any, tenantId)))).filter(Boolean);
      productData._pendingConcIds = concIds;
    }
    if (data.segment) {
      const segNames = data.segment.split(',').map((s: string) => s.trim()).filter(Boolean);
      const segIds = (await Promise.all(segNames.map((n: string) => findTaxonomyOnly(n, 'segment' as any, tenantId)))).filter(Boolean);
      productData._pendingSegIds = segIds;
    }
    if (data.categories) {
      const catNames = data.categories.split(',').map((s: string) => s.trim()).filter(Boolean);
      const catIds = (await Promise.all(catNames.map(async (n: string) => {
        const cat = await Category.findOne({ name: { $regex: `^${n.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, tenantId });
        return cat?._id || null;
      }))).filter(Boolean);
      if (catIds.length > 0) productData.categories = catIds;
    }
    const product = new Product(productData);
    const saved = await product.save();

    // Ghi taxonomy term links vào bảng trung gian
    await Promise.all([
      (productData._pendingScentIds as any[])?.length > 0 && ProductTaxonomyTermService.setTermsForProduct(saved._id.toString(), 'scent_group', productData._pendingScentIds as any[], tenantId),
      (productData._pendingConcIds as any[])?.length > 0 && ProductTaxonomyTermService.setTermsForProduct(saved._id.toString(), 'concentration', productData._pendingConcIds as any[], tenantId),
      (productData._pendingSegIds as any[])?.length > 0 && ProductTaxonomyTermService.setTermsForProduct(saved._id.toString(), 'segment', productData._pendingSegIds as any[], tenantId),
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
      const { ProductSEO } = await import('../../models/ProductSEO.ts');
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
    await clearProductCache(tenantId);

    return saved;
  }
}

/**
 * Helper: xóa toàn bộ cache product list
 */
async function clearProductCache(tenantId: string): Promise<void> {
  try {
    const keysToDelete = [
      `products:new:tag:${tenantId}`,
      `products:new:tag:v3:${tenantId}`,
      `products:limited:tag:v2:${tenantId}`,
      `products:sale:tag:${tenantId}`,
      `products:trending:tag:${tenantId}`,
      `products:trending:tag:v3:${tenantId}`,
    ];
    await Promise.all(keysToDelete.map(k => redis.del(k)));
  } catch (err) {
    console.warn('Failed to clear product caches:', err);
  }
}
