import { Brand } from '../models/Brand.ts';
import type { IBrand } from '../models/Brand.ts';
import { ImageService } from './ImageService.ts';

export class BrandService {
  /**
   * Lấy danh sách toàn bộ thương hiệu của tenant
   */
  static async getAllBrands(tenantId: string): Promise<IBrand[]> {
    let brands = await Brand.find({ tenantId }).sort({ name: 1 });
    if (brands.length === 0) {
      await Brand.insertMany([
        {
          name: "L'essence Signature",
          logo: '',
          origin: 'Việt Nam',
          gender: 'Unisex',
          scentGroup: 'Gỗ cay nồng',
          concentration: 'EDP',
          group: 'Niche',
          tenantId
        }
      ]);
      brands = await Brand.find({ tenantId }).sort({ name: 1 });
    }
    return brands;
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
}
