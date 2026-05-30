import { ProductSEO } from '../models/ProductSEO.ts';
import { generateEmbedding } from './ai/aiEmbedding.ts';

export interface VectorSearchResult {
  _id: string;
  name: string;
  price: number;
  description: string;
  brand: string;
  brandId: string;
  image?: string;
  variants: any[];
  rating: number;
  soldCount: number;
  vectorScore: number;
}

const VECTOR_INDEX = 'product_vector_index';

export class VectorSearchService {
  static async searchProducts(
    queryText: string,
    tenantId: string,
    limit = 10
  ): Promise<VectorSearchResult[]> {
    const embedding = await generateEmbedding(queryText);

    const results = await ProductSEO.aggregate<VectorSearchResult>([
      {
        $vectorSearch: {
          index: VECTOR_INDEX,
          queryVector: embedding,
          path: 'embedding',
          numCandidates: Math.max(limit * 10, 50),
          limit,
          filter: { tenantId },
        },
      },
      { $addFields: { vectorScore: { $meta: 'vectorSearchScore' } } },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'brands',
          localField: 'product.brandId',
          foreignField: '_id',
          as: 'brandData',
        },
      },
      { $unwind: { path: '$brandData', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: '$product._id',
          name: '$product.name',
          price: { $ifNull: ['$product.price', 0] },
          description: { $ifNull: ['$product.description', ''] },
          brand: '$brandData.name',
          brandId: '$product.brandId',
          image: '$product.image',
          variants: { $ifNull: ['$product.variants', []] },
          rating: { $ifNull: ['$product.rating', 0] },
          soldCount: { $ifNull: ['$product.soldCount', 0] },
          vectorScore: 1,
        },
      },
      { $sort: { vectorScore: -1 } },
    ]);

    return results;
  }

  static rrfMerge<T extends { _id: any }>(
    vectorResults: T[],
    keywordResults: T[],
    k = 60,
    limit = 4
  ): T[] {
    const scoreMap = new Map<string, number>();
    const docMap = new Map<string, T>();

    const updateScore = (docs: T[], startIndex: number) => {
      docs.forEach((doc, i) => {
        const id = doc._id.toString();
        scoreMap.set(id, (scoreMap.get(id) || 0) + 1 / (k + startIndex + i + 1));
        if (!docMap.has(id)) docMap.set(id, doc);
      });
    };

    updateScore(vectorResults, 0);
    updateScore(keywordResults, vectorResults.length);

    return [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => docMap.get(id)!);
  }
}
