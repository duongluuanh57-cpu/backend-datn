import { Tag } from '../models/Tag.ts';
import type { ITag } from '../models/Tag.ts';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export class TagService {
  /**
   * Fetch all tags for the tenant (backward compat — full list)
   */
  static async getAllTags(tenantId: string): Promise<ITag[]> {
    let tags = await Tag.find({ tenantId, status: 'active' }).sort({ name: 1 });
    if (tags.length === 0) {
      console.log(`[Tag Seeding] Seeding default tags ('Sale', 'New', and 'Limited') for tenant: ${tenantId}`);
      try {
        const defaultTags = [
          {
            name: 'Giảm giá',
            slug: 'Sale',
            status: 'active',
            tenantId
          },
          {
            name: 'Sản phẩm mới',
            slug: 'New',
            status: 'active',
            tenantId
          },
          {
            name: 'Giới hạn',
            slug: 'Limited',
            status: 'active',
            tenantId
          }
        ];
        await Tag.insertMany(defaultTags);
        tags = await Tag.find({ tenantId, status: 'active' }).sort({ name: 1 });
      } catch (err) {
        console.error('Error seeding default tags:', err);
      }
    }
    return tags;
  }

  /**
   * Fetch paginated tags for admin management
   */
  static async getPaginatedTags(
    tenantId: string,
    page: number = 1,
    limit: number = 25,
    search?: string
  ): Promise<{ items: ITag[]; total: number; page: number; totalPages: number }> {
    const query: Record<string, any> = { tenantId };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Tag.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Tag.countDocuments(query),
    ]);
    return { items: items as unknown as ITag[], total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Fetch details of a tag by ID
   */
  static async getTagById(id: string, tenantId: string): Promise<ITag | null> {
    return await Tag.findOne({ _id: id, tenantId });
  }

  /**
   * Create a new tag
   */
  static async createTag(data: Partial<ITag>, tenantId: string): Promise<ITag> {
    const slug = data.slug || slugify(data.name || '');
    const tag = new Tag({
      ...data,
      slug,
      tenantId
    });
    return await tag.save();
  }

  /**
   * Update tag info
   */
  static async updateTag(id: string, data: Partial<ITag>, tenantId: string): Promise<ITag | null> {
    const updateData = { ...data };
    if (data.name && !data.slug) {
      updateData.slug = slugify(data.name);
    }
    return await Tag.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updateData },
      { new: true }
    );
  }

  /**
   * Delete tag from the system
   */
  static async deleteTag(id: string, tenantId: string): Promise<boolean> {
    const tag = await Tag.findOne({ _id: id, tenantId });
    if (tag && (tag.slug === 'Sale' || tag.slug === 'New')) {
      throw new Error('Vui lòng kiểm tra lại thẻ (Sale / New).');
    }
    const result = await Tag.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}
