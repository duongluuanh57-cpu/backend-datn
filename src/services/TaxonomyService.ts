import mongoose from 'mongoose';
import { Taxonomy, type TaxonomySlug } from '../models/Taxonomy.ts';
import { TaxonomyTerm } from '../models/TaxonomyTerm.ts';

/**
 * TaxonomyService — unified CRUD cho segments, scent_groups, concentrations
 *
 * Gateway tương thích ngược: nhận type (segment|scent_group|concentration)
 * và chuyển thành slug của Taxonomy (cha) rồi thao tác trên TaxonomyTerm (con).
 */

async function getTaxonomyId(slug: TaxonomySlug, tenantId: string): Promise<mongoose.Types.ObjectId | null> {
  const doc = await Taxonomy.findOne({ slug, tenantId }).select('_id').lean();
  return doc ? doc._id as mongoose.Types.ObjectId : null;
}

export class TaxonomyService {
  /** Lấy tất cả taxonomy terms theo type (backward compat) */
  static async getAll(type: TaxonomySlug, tenantId: string) {
    const taxonomyId = await getTaxonomyId(type, tenantId);
    if (!taxonomyId) return [];
    return TaxonomyTerm.find({ taxonomyId, tenantId })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  /** Lấy paginated taxonomy terms (dùng cho admin management) */
  static async getPaginated(
    type: TaxonomySlug,
    tenantId: string,
    page: number = 1,
    limit: number = 25,
    search?: string
  ) {
    const taxonomyId = await getTaxonomyId(type, tenantId);
    if (!taxonomyId) return { items: [], total: 0, page, totalPages: 0 };

    const query: Record<string, any> = { taxonomyId, tenantId };
    if (search) {
      query.name = { $regex: '^' + search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      TaxonomyTerm.find(query).sort({ sortOrder: 1, name: 1 }).skip(skip).limit(limit).lean(),
      TaxonomyTerm.countDocuments(query),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** Lấy tất cả active taxonomy terms (dùng cho dropdown/filter) */
  static async getAllActive(type: TaxonomySlug, tenantId: string) {
    const taxonomyId = await getTaxonomyId(type, tenantId);
    if (!taxonomyId) return [];
    return TaxonomyTerm.find({ taxonomyId, tenantId, status: 'active' })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  static async getById(id: string, tenantId: string) {
    return TaxonomyTerm.findOne({ _id: id, tenantId }).lean();
  }

  static async create(data: {
    type: TaxonomySlug;
    name: string;
    slug: string;
    description?: string;
    sortOrder?: number;
    status?: 'active' | 'inactive';
  }, tenantId: string) {
    const taxonomyId = await getTaxonomyId(data.type, tenantId);
    if (!taxonomyId) {
      throw new Error(`Vui lòng kiểm tra lại danh mục "${data.type}".`);
    }
    const { type, ...rest } = data;
    return TaxonomyTerm.create({ ...rest, taxonomyId, tenantId });
  }

  static async update(id: string, data: Partial<{
    name: string;
    slug: string;
    description: string;
    sortOrder: number;
    status: 'active' | 'inactive';
  }>, tenantId: string) {
    return TaxonomyTerm.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true }
    );
  }

  static async delete(id: string, tenantId: string) {
    // Xoá liên kết product ↔ term trước
    const { ProductTaxonomyTerm } = await import('../models/ProductTaxonomyTerm.ts');
    await ProductTaxonomyTerm.deleteMany({ termId: id, tenantId });
    const result = await TaxonomyTerm.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }

  /** Helper: lấy name list theo type — dùng để populate product filters */
  static async getNamesByType(type: TaxonomySlug, tenantId: string): Promise<string[]> {
    const taxonomyId = await getTaxonomyId(type, tenantId);
    if (!taxonomyId) return [];
    const docs = await TaxonomyTerm.find({ taxonomyId, tenantId, status: 'active' })
      .select('name')
      .lean();
    return docs.map((d) => d.name);
  }
}