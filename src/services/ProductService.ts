import { Product } from '../models/Product.ts';
import type { IProduct } from '../models/Product.ts';
import { redis } from '../config/redis.ts';
import { ImageService } from './ImageService.ts';

export class ProductService {
  private static CACHE_TTL = 300; // 5 minutes

  /**
   * Lấy danh sách sản phẩm mới nhất
   */
  static async getNewProducts(tenantId: string): Promise<IProduct[]> {
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

    // 2. Nếu không có cache, lấy từ DB
    const products = await Product.find({
      tenantId,
      tag: { $regex: /(?:^|,)\s*New\s*(?:,|$)/i }
    })
      .sort({ createdAt: -1 })
      .limit(4);

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
  static async getSaleProducts(tenantId: string): Promise<IProduct[]> {
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

    // 2. Nếu không có cache, lấy từ DB
    const now = new Date();
    
    // Tìm sản phẩm giảm giá có thời gian kết thúc gần nhất trong tương lai
    const upcomingSale = await Product.findOne({
      tenantId,
      tag: { $regex: /(?:^|,)\s*Sale\s*(?:,|$)/i },
      discountPercentage: { $gt: 0 },
      discountEndDate: { $gt: now }
    }).sort({ discountEndDate: 1 });

    let products = [];

    if (upcomingSale && upcomingSale.discountEndDate) {
      const targetEndDate = upcomingSale.discountEndDate;
      // Chỉ lấy các sản phẩm có cùng thời gian kết thúc giảm giá này
      products = await Product.find({
        tenantId,
        tag: { $regex: /(?:^|,)\s*Sale\s*(?:,|$)/i },
        discountPercentage: { $gt: 0 },
        discountEndDate: targetEndDate,
        $or: [
          { discountStartDate: null },
          { discountStartDate: { $exists: false } },
          { discountStartDate: { $lte: now } }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(4);
    } else {
      // Nếu không có sản phẩm nào có hạn giảm giá tương lai, lấy các sản phẩm giảm giá vô thời hạn (null hoặc không có hạn)
      products = await Product.find({
        tenantId,
        tag: { $regex: /(?:^|,)\s*Sale\s*(?:,|$)/i },
        discountPercentage: { $gt: 0 },
        $and: [
          {
            $or: [
              { discountStartDate: null },
              { discountStartDate: { $exists: false } },
              { discountStartDate: { $lte: now } }
            ]
          },
          {
            $or: [
              { discountEndDate: null },
              { discountEndDate: { $exists: false } }
            ]
          }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(4);
    }

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
  static async getAllProducts(tenantId: string): Promise<IProduct[]> {
    return await Product.find({ tenantId }).sort({ createdAt: -1 });
  }

  /**
   * Lấy chi tiết một sản phẩm
   */
  static async getProductById(id: string, tenantId: string): Promise<IProduct | null> {
    return await Product.findOne({ _id: id, tenantId });
  }

  /**
   * Cập nhật sản phẩm
   */
  static async updateProduct(id: string, data: Partial<IProduct>, tenantId: string): Promise<IProduct | null> {
    let oldImage = '';
    if (data.image) {
      const oldProduct = await Product.findOne({ _id: id, tenantId });
      if (oldProduct && oldProduct.image && oldProduct.image !== data.image) {
        oldImage = oldProduct.image;
      }
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true }
    );

    // Xóa các cache liên quan sau khi cập nhật
    if (updatedProduct) {
      if (oldImage) {
        ImageService.deleteFromR2(oldImage).catch(err => {
          console.error('Lỗi khi xóa ảnh cũ sản phẩm khỏi R2:', err);
        });
      }

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

    const result = await Product.deleteOne({ _id: id, tenantId });
    if (result.deletedCount > 0) {
      if (product.image) {
        ImageService.deleteFromR2(product.image).catch(err => {
          console.error('Lỗi khi xóa ảnh sản phẩm khỏi R2:', err);
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
   * Tạo sản phẩm mới
   */
  static async createProduct(data: Partial<IProduct>, tenantId: string): Promise<IProduct> {
    const product = new Product({
      ...data,
      tenantId
    });
    const saved = await product.save();
    
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
