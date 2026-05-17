import { Brand } from '../models/Brand.ts';
import type { IBrand } from '../models/Brand.ts';

export class BrandService {
  /**
   * Lấy danh sách toàn bộ thương hiệu của tenant
   */
  static async getAllBrands(tenantId: string): Promise<IBrand[]> {
    return await Brand.find({ tenantId }).sort({ name: 1 });
  }

  /**
   * Lấy chi tiết thương hiệu theo ID
   */
  static async getBrandById(id: string, tenantId: string): Promise<IBrand | null> {
    return await Brand.findOne({ _id: id, tenantId });
  }

  /**
   * Tạo thương hiệu mới
   */
  static async createBrand(data: Partial<IBrand>, tenantId: string): Promise<IBrand> {
    const brand = new Brand({
      ...data,
      tenantId
    });
    return await brand.save();
  }

  /**
   * Cập nhật thông tin thương hiệu
   */
  static async updateBrand(id: string, data: Partial<IBrand>, tenantId: string): Promise<IBrand | null> {
    return await Brand.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true }
    );
  }

  /**
   * Xóa thương hiệu khỏi hệ thống
   */
  static async deleteBrand(id: string, tenantId: string): Promise<boolean> {
    const result = await Brand.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}
