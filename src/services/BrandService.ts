import { Brand } from '../models/Brand.ts';
import type { IBrand } from '../models/Brand.ts';
import { ImageService } from './ImageService.ts';

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
    let oldLogo = '';
    if (data.logo) {
      const oldBrand = await Brand.findOne({ _id: id, tenantId });
      if (oldBrand && oldBrand.logo && oldBrand.logo !== data.logo) {
        oldLogo = oldBrand.logo;
      }
    }

    const updatedBrand = await Brand.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true }
    );

    if (updatedBrand && oldLogo) {
      ImageService.deleteFromR2(oldLogo).catch(err => {
        console.error('Lỗi khi xóa logo cũ thương hiệu khỏi R2:', err);
      });
    }

    return updatedBrand;
  }

  /**
   * Xóa thương hiệu khỏi hệ thống
   */
  static async deleteBrand(id: string, tenantId: string): Promise<boolean> {
    const brand = await Brand.findOne({ _id: id, tenantId });
    if (!brand) return false;

    const result = await Brand.deleteOne({ _id: id, tenantId });
    if (result.deletedCount > 0 && brand.logo) {
      ImageService.deleteFromR2(brand.logo).catch(err => {
        console.error('Lỗi khi xóa logo thương hiệu khỏi R2:', err);
      });
    }
    return result.deletedCount > 0;
  }

  /**
   * Xóa hàng loạt thương hiệu khỏi hệ thống
   */
  static async bulkDeleteBrands(ids: string[], tenantId: string): Promise<boolean> {
    if (!ids || ids.length === 0) return false;
    
    // Tìm các thương hiệu để lấy danh sách logo cần xóa
    const brands = await Brand.find({ _id: { $in: ids }, tenantId });
    const logos = brands.map(b => b.logo).filter(Boolean);

    const result = await Brand.deleteMany({ _id: { $in: ids }, tenantId });
    if (result.deletedCount > 0 && logos.length > 0) {
      for (const logo of logos) {
        ImageService.deleteFromR2(logo).catch(err => {
          console.error('Lỗi khi xóa logo thương hiệu khỏi R2 trong bulk delete:', err);
        });
      }
    }
    return result.deletedCount > 0;
  }
}
