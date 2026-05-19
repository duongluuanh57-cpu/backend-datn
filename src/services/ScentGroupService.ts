import { ScentGroup } from '../models/ScentGroup.ts';
import type { IScentGroup } from '../models/ScentGroup.ts';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/[^\w\-]+/g, '') // remove all non-word chars
    .replace(/\--+/g, '-') // replace multiple - with single -
    .replace(/^-+/, '') // trim - from start
    .replace(/-+$/, ''); // trim - from end
}

export class ScentGroupService {
  /**
   * Fetch all scent groups for the tenant
   */
  static async getAllScentGroups(tenantId: string): Promise<IScentGroup[]> {
    let list = await ScentGroup.find({ tenantId }).sort({ name: 1 });
    if (list.length === 0) {
      console.log(`🌱 [ScentGroup Seeding] Seeding default scent groups for tenant: ${tenantId}`);
      try {
        const defaults = [
          { name: 'Hương Gỗ (Woody)', slug: 'woody', status: 'active', tenantId },
          { name: 'Hương Hoa Cỏ (Floral)', slug: 'floral', status: 'active', tenantId },
          { name: 'Hương Phương Đông (Oriental)', slug: 'oriental', status: 'active', tenantId },
          { name: 'Hương Cam Chanh (Citrus)', slug: 'citrus', status: 'active', tenantId },
          { name: 'Hương Gia Vị (Spicy)', slug: 'spicy', status: 'active', tenantId },
          { name: 'Hương Da Thuộc (Leather)', slug: 'leather', status: 'active', tenantId },
          { name: 'Hương Nước (Aquatic)', slug: 'aquatic', status: 'active', tenantId },
          { name: 'Hương Trái Cây (Fruity)', slug: 'fruity', status: 'active', tenantId },
          { name: 'Hương Rêu Sồi (Chypre)', slug: 'chypre', status: 'active', tenantId },
          { name: 'Hương Thảo Mộc (Fougere)', slug: 'fougere', status: 'active', tenantId }
        ];
        await ScentGroup.insertMany(defaults);
        list = await ScentGroup.find({ tenantId }).sort({ name: 1 });
      } catch (err) {
        console.error('❌ Error seeding default scent groups:', err);
      }
    }
    return list;
  }

  /**
   * Fetch details of a scent group by ID
   */
  static async getScentGroupById(id: string, tenantId: string): Promise<IScentGroup | null> {
    return await ScentGroup.findOne({ _id: id, tenantId });
  }

  /**
   * Create a new scent group
   */
  static async createScentGroup(data: Partial<IScentGroup>, tenantId: string): Promise<IScentGroup> {
    const slug = data.slug || slugify(data.name || '');
    const item = new ScentGroup({
      ...data,
      slug,
      tenantId
    });
    return await item.save();
  }

  /**
   * Update scent group info
   */
  static async updateScentGroup(id: string, data: Partial<IScentGroup>, tenantId: string): Promise<IScentGroup | null> {
    const updateData = { ...data };
    if (data.name && !data.slug) {
      updateData.slug = slugify(data.name);
    }
    return await ScentGroup.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updateData },
      { new: true }
    );
  }

  /**
   * Delete scent group from the system
   */
  static async deleteScentGroup(id: string, tenantId: string): Promise<boolean> {
    const result = await ScentGroup.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}
