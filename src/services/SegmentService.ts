import { Segment } from '../models/Segment.ts';
import type { ISegment } from '../models/Segment.ts';

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

export class SegmentService {
  /**
   * Fetch all segments for the tenant
   */
  static async getAllSegments(tenantId: string): Promise<ISegment[]> {
    let list = await Segment.find({ tenantId }).sort({ name: 1 });
    if (list.length === 0) {
      console.log(`🌱 [Segment Seeding] Seeding default segments for tenant: ${tenantId}`);
      try {
        const defaults = [
          { name: 'Niche', slug: 'niche', status: 'active', tenantId },
          { name: 'Designer', slug: 'designer', status: 'active', tenantId },
          { name: 'Classic', slug: 'classic', status: 'active', tenantId },
          { name: 'Luxury', slug: 'luxury', status: 'active', tenantId }
        ];
        await Segment.insertMany(defaults);
        list = await Segment.find({ tenantId }).sort({ name: 1 });
      } catch (err) {
        console.error('❌ Error seeding default segments:', err);
      }
    }
    return list;
  }

  /**
   * Fetch details of a segment by ID
   */
  static async getSegmentById(id: string, tenantId: string): Promise<ISegment | null> {
    return await Segment.findOne({ _id: id, tenantId });
  }

  /**
   * Create a new segment
   */
  static async createSegment(data: Partial<ISegment>, tenantId: string): Promise<ISegment> {
    const slug = data.slug || slugify(data.name || '');
    const item = new Segment({
      ...data,
      slug,
      tenantId
    });
    return await item.save();
  }

  /**
   * Update segment info
   */
  static async updateSegment(id: string, data: Partial<ISegment>, tenantId: string): Promise<ISegment | null> {
    const updateData = { ...data };
    if (data.name && !data.slug) {
      updateData.slug = slugify(data.name);
    }
    return await Segment.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updateData },
      { new: true }
    );
  }

  /**
   * Delete segment from the system
   */
  static async deleteSegment(id: string, tenantId: string): Promise<boolean> {
    const result = await Segment.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}
