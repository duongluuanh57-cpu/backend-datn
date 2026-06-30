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
import { FuzzyMatchCache } from '../FuzzyMatchCache.ts';
import { parseSizes, slugify } from './productHelpers.ts';

export class ProductMutationService {

  /**
   * Cập nhật sản phẩm
   */
  static async updateProduct(id: string, data: any, tenantId: string): Promise<any | null> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.reviewsCount !== undefined) updateData.reviewsCount = data.reviewsCount;
    if (data.discountPercentage !== undefined) updateData.discountPercentage = data.discountPercentage;
    if (data.discountStartDate !== undefined) updateData.discountStartDate = data.discountStartDate;
    if (data.discountEndDate !== undefined) updateData.discountEndDate = data.discountEndDate;
    if (data.keywords !== undefined) updateData.keywords = data.keywords;
    if (data.longevity !== undefined) updateData.longevity = data.longevity;
    if (data.sillage !== undefined) updateData.sillage = data.sillage;
    if (data.durability !== undefined) updateData.durability = data.durability;
    if (data.scentTrail !== undefined) updateData.scentTrail = data.scentTrail;
    if (data.style !== undefined) updateData.style = data.style;
    if (data.suitableFor !== undefined) updateData.suitableFor = data.suitableFor;
    if (data.occasion !== undefined) updateData.occasion = data.occasion;
    if (data.season !== undefined) updateData.season = data.season;
    if (data.time !== undefined) updateData.time = data.time;

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

    // Tags mapping — ghi vào bảng trung gian ProductTag (CHỈ dùng tag đã tồn tại trong DB)
    if (data.tag !== undefined) {
      const tagSlugs = data.tag.split(',').map((s: string) => s.trim()).filter(Boolean);
      const tagDocs = await Tag.find({ slug: { $in: tagSlugs }, tenantId }).lean();
      const foundSlugs = new Set(tagDocs.map(t => t.slug));
      const skipped = tagSlugs.filter(s => !foundSlugs.has(s));
      if (skipped.length > 0) {
        console.warn(`⚠️ [Tag] Skipping ${skipped.length} tag(s) not found in DB: ${skipped.join(', ')} — will NOT auto-create`);
      }
      const tagIds = tagDocs.map(t => t._id);
      // Xóa tags cũ rồi insert lại
      await ProductTag.deleteMany({ productId: id, tenantId });
      if (tagIds.length > 0) {
        await ProductTag.insertMany(tagIds.map(tagId => ({ productId: id, tagId, tenantId })));
      }
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
      // Xóa tag links
      await ProductTag.deleteMany({ productId: id, tenantId });
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
      // Xóa tag links
      await ProductTag.deleteMany({ productId: { $in: ids }, tenantId });
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
    if (data.reviewsCount !== undefined) productData.reviewsCount = data.reviewsCount;
    if (data.discountPercentage !== undefined) productData.discountPercentage = data.discountPercentage;
    if (data.discountStartDate !== undefined) productData.discountStartDate = data.discountStartDate;
    if (data.discountEndDate !== undefined) productData.discountEndDate = data.discountEndDate;
    if (data.image !== undefined) productData.image = data.image;
    if (data.keywords !== undefined) productData.keywords = data.keywords;
    if (data.longevity !== undefined) productData.longevity = data.longevity;
    if (data.sillage !== undefined) productData.sillage = data.sillage;
    if (data.durability !== undefined) productData.durability = data.durability;
    if (data.scentTrail !== undefined) productData.scentTrail = data.scentTrail;
    if (data.style !== undefined) productData.style = data.style;
    if (data.suitableFor !== undefined) productData.suitableFor = data.suitableFor;
    if (data.occasion !== undefined) productData.occasion = data.occasion;
    if (data.season !== undefined) productData.season = data.season;
    if (data.time !== undefined) productData.time = data.time;

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

    await Promise.all([
    ]);

    // Ghi tag links vào bảng trung gian ProductTag (CHỈ dùng tag đã tồn tại trong DB)
    if (pendingTagSlugs.length > 0) {
      const tagDocs = await Tag.find({ slug: { $in: pendingTagSlugs }, tenantId }).lean();
      const foundSlugs = new Set(tagDocs.map(t => t.slug));
      const skipped = pendingTagSlugs.filter(s => !foundSlugs.has(s));
      if (skipped.length > 0) {
        console.warn(`⚠️ [Tag] Skipping ${skipped.length} tag(s) not found in DB: ${skipped.join(', ')} — will NOT auto-create`);
      }
      const tagIds = tagDocs.map(t => t._id);
      if (tagIds.length > 0) {
        await ProductTag.insertMany(tagIds.map(tagId => ({ productId: saved._id, tagId, tenantId })));
      }
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
