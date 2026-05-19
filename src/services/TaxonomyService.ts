import { ProductTaxonomy, type TaxonomyType } from '../models/ProductTaxonomy.ts';

export class TaxonomyService {
  /**
   * Lấy tất cả taxonomy theo type
   */
  static async getAll(type: TaxonomyType, tenantId: string) {
    return ProductTaxonomy.find({ type, tenantId })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  /**
   * Lấy tất cả active theo type (dùng cho dropdown/filter)
   */
  static async getAllActive(type: TaxonomyType, tenantId: string) {
    return ProductTaxonomy.find({ type, tenantId, status: 'active' })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  static async getById(id: string, tenantId: string) {
    return ProductTaxonomy.findOne({ _id: id, tenantId }).lean();
  }

  static async create(data: {
    type: TaxonomyType;
    name: string;
    slug: string;
    description?: string;
    sortOrder?: number;
    status?: 'active' | 'inactive';
  }, tenantId: string) {
    return ProductTaxonomy.create({ ...data, tenantId });
  }

  static async update(id: string, data: Partial<{
    name: string;
    slug: string;
    description: string;
    sortOrder: number;
    status: 'active' | 'inactive';
  }>, tenantId: string) {
    return ProductTaxonomy.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true }
    );
  }

  static async delete(id: string, tenantId: string) {
    const result = await ProductTaxonomy.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }

  /**
   * Helper: lấy name list theo type — dùng để populate product filters
   */
  static async getNamesByType(type: TaxonomyType, tenantId: string): Promise<string[]> {
    const docs = await ProductTaxonomy.find({ type, tenantId, status: 'active' })
      .select('name')
      .lean();
    return docs.map((d) => d.name);
  }
}
