import { Taxonomy, type TaxonomySlug } from '../../models/Taxonomy.ts';
import { TaxonomyTerm } from '../../models/TaxonomyTerm.ts';
import { ProductTaxonomyTerm } from '../../models/ProductTaxonomyTerm.ts';

export class TaxonomyService {
  /** Lấy tất cả taxonomy của tenant */
  static async getAll(tenantId: string) {
    return Taxonomy.find({ tenantId }).sort({ sortOrder: 1, name: 1 }).lean();
  }

  /** Lấy taxonomy theo slug (scent_group | concentration | segment) */
  static async getBySlug(slug: TaxonomySlug, tenantId: string) {
    return Taxonomy.findOne({ slug, tenantId }).lean();
  }

  static async getById(id: string, tenantId: string) {
    return Taxonomy.findOne({ _id: id, tenantId }).lean();
  }

  static async create(
    data: { slug: TaxonomySlug; name: string; description?: string; sortOrder?: number },
    tenantId: string
  ) {
    return Taxonomy.create({ ...data, tenantId });
  }

  static async update(
    id: string,
    data: Partial<{ name: string; description: string; sortOrder: number; status: 'active' | 'inactive' }>,
    tenantId: string
  ) {
    return Taxonomy.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true });
  }

  static async delete(id: string, tenantId: string) {
    // Xóa tất cả terms thuộc taxonomy này trước
    const terms = await TaxonomyTerm.find({ taxonomyId: id, tenantId }).select('_id').lean();
    const termIds = terms.map((t) => t._id);
    if (termIds.length > 0) {
      await ProductTaxonomyTerm.deleteMany({ termId: { $in: termIds }, tenantId });
      await TaxonomyTerm.deleteMany({ taxonomyId: id, tenantId });
    }
    const result = await Taxonomy.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}