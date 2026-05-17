import { Product } from '../models/Product.ts';
import type { IProduct } from '../models/Product.ts';
import { redis } from '../config/redis.ts';

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
    const products = await Product.find({ tenantId, tag: 'New' })
      .sort({ createdAt: -1 })
      .limit(10);

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
    const products = await Product.find({ tenantId, tag: 'Sale' })
      .sort({ createdAt: -1 })
      .limit(10);

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
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true }
    );

    // Xóa các cache liên quan sau khi cập nhật
    if (updatedProduct) {
      await redis.del(`products:new:tag:${tenantId}`);
      await redis.del(`products:sale:tag:${tenantId}`);
      // Nếu có cache cho từng sản phẩm riêng lẻ, cũng cần xóa:
      await redis.del(`products:${id}:${tenantId}`); // Giả sử có cache cho từng ID
    }
    
    return updatedProduct;
  }

  /**
   * Xóa sản phẩm
   */
  static async deleteProduct(id: string, tenantId: string): Promise<boolean> {
    const result = await Product.deleteOne({ _id: id, tenantId });
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
    return await product.save();
  }
}
