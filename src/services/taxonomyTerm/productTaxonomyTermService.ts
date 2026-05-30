import mongoose from 'mongoose';
import { Taxonomy, type TaxonomySlug } from '../../models/Taxonomy.ts';
import { ProductTaxonomyTerm } from '../../models/ProductTaxonomyTerm.ts';

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
      category: [],
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

    try {
      await ProductTaxonomyTerm.insertMany(docs, { ordered: false });
    } catch (err: any) {
      // E11000 duplicate key — race condition between concurrent requests, ignore
      if (err?.code !== 11000 && err?.errorResult?.code !== 11000) {
        throw err;
      }
    }
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