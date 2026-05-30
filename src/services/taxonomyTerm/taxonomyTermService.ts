import mongoose from 'mongoose';
import { Taxonomy, type TaxonomySlug } from '../../models/Taxonomy.ts';
import { TaxonomyTerm } from '../../models/TaxonomyTerm.ts';
import { ProductTaxonomyTerm } from '../../models/ProductTaxonomyTerm.ts';
import { FuzzyMatchCache } from '../FuzzyMatchCache.ts';

export class TaxonomyTermService {
  /** Lấy tất cả terms của một taxonomy (full list — backward compat) */
  static async getAll(taxonomyId: string, tenantId: string) {
    return TaxonomyTerm.find({ taxonomyId, tenantId })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  /** Lấy paginated terms của một taxonomy (dùng cho admin management) */
  static async getPaginated(
    taxonomyId: string,
    tenantId: string,
    page: number = 1,
    limit: number = 25,
    search?: string
  ) {
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

  /** Lấy active terms — dùng cho dropdown/filter */
  static async getAllActive(taxonomyId: string, tenantId: string) {
    return TaxonomyTerm.find({ taxonomyId, tenantId, status: 'active' })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  /** Lấy tất cả active terms theo slug của taxonomy cha (tiện dùng hơn khi không có taxonomyId) */
  static async getAllActiveBySlug(slug: TaxonomySlug, tenantId: string) {
    const taxonomy = await Taxonomy.findOne({ slug, tenantId }).lean();
    if (!taxonomy) return [];
    return TaxonomyTerm.find({ taxonomyId: taxonomy._id, tenantId, status: 'active' })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  static async getById(id: string, tenantId: string) {
    return TaxonomyTerm.findOne({ _id: id, tenantId }).populate('taxonomyId').lean();
  }

  static async create(
    data: {
      taxonomyId: string;
      name: string;
      slug: string;
      description?: string;
      sortOrder?: number;
      status?: 'active' | 'inactive';
    },
    tenantId: string
  ) {
    const term = await TaxonomyTerm.create({ ...data, tenantId });
    FuzzyMatchCache.invalidateAll();
    return term;
  }

  static async update(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string;
      sortOrder: number;
      status: 'active' | 'inactive';
    }>,
    tenantId: string
  ) {
    const term = await TaxonomyTerm.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true });
    FuzzyMatchCache.invalidateAll();
    return term;
  }

  static async delete(id: string, tenantId: string) {
    await ProductTaxonomyTerm.deleteMany({ termId: id, tenantId });
    const result = await TaxonomyTerm.deleteOne({ _id: id, tenantId });
    FuzzyMatchCache.invalidateAll();
    return result.deletedCount > 0;
  }

  /**
   * Helper: tìm term theo tên (fuzzy, case-insensitive) trong một taxonomy slug
   * Dùng trong ProductService khi import/create product từ text
   * Dùng FuzzyMatchCache để tránh fetch DB mỗi lần
   */
  static async findByName(
    name: string,
    slug: TaxonomySlug,
    tenantId: string
  ): Promise<mongoose.Types.ObjectId | null> {
    if (!name?.trim()) return null;

    const taxonomy = await Taxonomy.findOne({ slug, tenantId }).lean();
    if (!taxonomy) return null;

    const cacheKey = `terms:${String(slug)}:${tenantId}:active`;
    const { lookup } = await FuzzyMatchCache.getOrFetch(
      cacheKey,
      () => TaxonomyTerm.find({
        taxonomyId: taxonomy._id,
        tenantId,
        status: 'active',
      }).lean()
    );

    const matched = FuzzyMatchCache.fuzzyFind(name, lookup, (t: any) => t.name);
    if (matched) {
      if (FuzzyMatchCache.normalize(matched.name) !== FuzzyMatchCache.normalize(name)) {
        console.warn(`⚠️ [TaxonomyTerm] Partial match "${name}" → "${matched.name}" (${slug})`);
      }
      return matched._id as mongoose.Types.ObjectId;
    }

    console.warn(`⚠️ [TaxonomyTerm] "${name}" (${slug}) not found — skipping`);
    return null;
  }
}