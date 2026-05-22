import mongoose from 'mongoose';
import { Taxonomy, type TaxonomySlug } from '../models/Taxonomy.ts';
import { TaxonomyTerm } from '../models/TaxonomyTerm.ts';
import { ProductTaxonomyTerm } from '../models/ProductTaxonomyTerm.ts';

// ─────────────────────────────────────────────
// TAXONOMY (cha)
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// TAXONOMY TERM (con)
// ─────────────────────────────────────────────

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
      query.name = { $regex: search, $options: 'i' };
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
    return TaxonomyTerm.create({ ...data, tenantId });
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
    return TaxonomyTerm.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true });
  }

  static async delete(id: string, tenantId: string) {
    // Xóa tất cả liên kết product ↔ term trước
    await ProductTaxonomyTerm.deleteMany({ termId: id, tenantId });
    const result = await TaxonomyTerm.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }

  /**
   * Helper: tìm term theo tên (fuzzy, case-insensitive) trong một taxonomy slug
   * Dùng trong ProductService khi import/create product từ text
   */
  static async findByName(
    name: string,
    slug: TaxonomySlug,
    tenantId: string
  ): Promise<mongoose.Types.ObjectId | null> {
    if (!name?.trim()) return null;

    const taxonomy = await Taxonomy.findOne({ slug, tenantId }).lean();
    if (!taxonomy) return null;

    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const normalizedInput = norm(name);

    const allTerms = await TaxonomyTerm.find({
      taxonomyId: taxonomy._id,
      tenantId,
      status: 'active',
    }).lean();

    // Exact name match
    const exact = allTerms.find((t) => norm(t.name) === normalizedInput);
    if (exact) return exact._id as mongoose.Types.ObjectId;

    // Partial match
    const partial = allTerms.find(
      (t) =>
        norm(t.name).includes(normalizedInput) || normalizedInput.includes(norm(t.name))
    );
    if (partial) {
      console.warn(`⚠️ [TaxonomyTerm] Partial match "${name}" → "${partial.name}" (${slug})`);
      return partial._id as mongoose.Types.ObjectId;
    }

    console.warn(`⚠️ [TaxonomyTerm] "${name}" (${slug}) not found — skipping`);
    return null;
  }
}

// ─────────────────────────────────────────────
// PRODUCT ↔ TAXONOMY TERM (trung gian)
// ─────────────────────────────────────────────

export class ProductTaxonomyTermService {
  /**
   * Lấy tất cả terms của một sản phẩm, nhóm theo taxonomy slug
   * Trả về: { scent_group: [...], concentration: [...], segment: [...] }
   */
  static async getTermsForProduct(
    productId: string,
    tenantId: string
  ): Promise<Record<TaxonomySlug, any[]>> {
    const links = await ProductTaxonomyTerm.find({ productId, tenantId })
      .populate({ path: 'termId', model: 'TaxonomyTerm' })
      .populate({ path: 'taxonomyId', model: 'Taxonomy' })
      .lean();

    const result: Record<string, any[]> = {
      scent_group: [],
      concentration: [],
      segment: [],
    };

    for (const link of links) {
      const taxonomySlug = (link.taxonomyId as any)?.slug as TaxonomySlug;
      if (taxonomySlug && result[taxonomySlug]) {
        result[taxonomySlug].push(link.termId);
      }
    }

    return result as Record<TaxonomySlug, any[]>;
  }

  /**
   * Lấy tất cả productId thuộc một term
   */
  static async getProductIdsByTerm(termId: string, tenantId: string): Promise<string[]> {
    const links = await ProductTaxonomyTerm.find({ termId, tenantId }).select('productId').lean();
    return links.map((l) => l.productId.toString());
  }

  /**
   * Lấy tất cả productId thuộc một taxonomy (theo slug)
   */
  static async getProductIdsByTaxonomySlug(
    slug: TaxonomySlug,
    tenantId: string
  ): Promise<string[]> {
    const taxonomy = await Taxonomy.findOne({ slug, tenantId }).lean();
    if (!taxonomy) return [];
    const links = await ProductTaxonomyTerm.find({
      taxonomyId: taxonomy._id,
      tenantId,
    })
      .select('productId')
      .lean();
    return [...new Set(links.map((l) => l.productId.toString()))];
  }

  /**
   * Gán danh sách terms cho một sản phẩm theo taxonomy slug
   * Xóa các liên kết cũ của taxonomy đó trước khi gán mới
   */
  static async setTermsForProduct(
    productId: string,
    slug: TaxonomySlug,
    termIds: mongoose.Types.ObjectId[],
    tenantId: string
  ): Promise<void> {
    const taxonomy = await Taxonomy.findOne({ slug, tenantId }).lean();
    if (!taxonomy) {
      console.warn(`⚠️ [ProductTaxonomyTerm] Taxonomy "${slug}" not found for tenant ${tenantId}`);
      return;
    }

    // Xóa liên kết cũ của taxonomy này với sản phẩm
    await ProductTaxonomyTerm.deleteMany({
      productId,
      taxonomyId: taxonomy._id,
      tenantId,
    });

    if (termIds.length === 0) return;

    // Tạo liên kết mới
    const docs = termIds.map((termId) => ({
      tenantId,
      productId: new mongoose.Types.ObjectId(productId),
      termId,
      taxonomyId: taxonomy._id,
    }));

    await ProductTaxonomyTerm.insertMany(docs, { ordered: false });
  }

  /**
   * Xóa tất cả liên kết của một sản phẩm (dùng khi xóa product)
   */
  static async deleteAllForProduct(productId: string, tenantId: string): Promise<void> {
    await ProductTaxonomyTerm.deleteMany({ productId, tenantId });
  }

  /**
   * Xóa tất cả liên kết của nhiều sản phẩm (dùng khi bulk delete)
   */
  static async deleteAllForProducts(productIds: string[], tenantId: string): Promise<void> {
    if (productIds.length === 0) return;
    await ProductTaxonomyTerm.deleteMany({
      productId: { $in: productIds },
      tenantId,
    });
  }
}
