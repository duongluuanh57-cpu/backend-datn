import mongoose from 'mongoose';
import { VectorSearchService } from './VectorSearchService.ts';

async function runKeywordSearch(query: string, tenantId: string, limit: number) {
  const queryWords = query.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2);
  if (queryWords.length === 0) return [];

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameConditions = queryWords.map(word => ({
    name: { $regex: '^' + escapeRegex(word), $options: 'i' },
  }));
  const brandPattern = queryWords.map(w => '^' + escapeRegex(w)).join('|');

  const BUFFER = 2;
  return mongoose.connection.db!.collection('products').aggregate([
    { $match: { tenantId, $or: nameConditions } },
    { $sort: { soldCount: -1, rating: -1 } },
    { $limit: limit * BUFFER },
    { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brandData' } },
    { $unwind: { path: '$brandData', preserveNullAndEmptyArrays: true } },
    { $match: { $or: [...nameConditions, { 'brandData.name': { $regex: brandPattern, $options: 'i' } }] } },
    { $limit: limit },
    { $project: { _id: 1, name: 1, price: 1, description: 1, brand: '$brandData.name', brandId: 1, images: 1, variants: 1, rating: 1, soldCount: 1 } },
  ]).toArray();
}

export class SearchService {
  static async hybridSearch(query: string, tenantId: string, limit: number = 4) {
    try {
      const cleanQuery = query.toLowerCase().trim();
      if (!cleanQuery) return { products: [], mode: 'general' };

      const confusionPatterns = [
        /^ủa+$/i, /^hả+$/i, /^gì(\s+vậy)?$/i,
        /^sao(\s+cơ)?$/i, /^ý(\s+là)?(\s+sao)?/i,
        /^cái(\s+gì)?$/i, /^đâu(\s+có)?/i,
        /^tại(\s+sao)?$/i, /^là(\s+sao)?$/i,
        /^ơ(\s+kìa)?/i, /^a(\s+là)?/i,
      ];

      if (confusionPatterns.some(p => p.test(cleanQuery))) {
        return { products: [], mode: 'confusion' };
      }

      const greetingPatterns = [
        /^(xin )?chào/i, /^hi+$/i, /^hello+$/i, /^hey+$/i,
        /^good (morning|afternoon|evening)/i,
        /^(chúc )?buổi (sáng|chiều|tối)/i,
        /^(bạn|mình) (có )?khỏe/i,
        /^(có ai|ai đó) (ở đây|không)/i,
        /^(cảm ơn|thanks|thank you)/i,
        /^tạm biệt|bye|goodbye/i,
      ];

      if (greetingPatterns.some(p => p.test(cleanQuery))) {
        return { products: [], mode: 'greeting' };
      }

      const vowelRatio = (cleanQuery.match(/[aeiouáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]/gi) || []).length / cleanQuery.length;
      const maxRepeat = Math.max(...(cleanQuery.match(/(.)\1+/g) || []).map(s => s.length));
      if (vowelRatio < 0.15 || maxRepeat >= 5 || /^[^aeiouy]{5,}$/i.test(cleanQuery.split(/\s+/).filter(Boolean).join(''))) {
        return { products: [], mode: 'gibberish' };
      }

      const queryWords = cleanQuery.split(/\s+/).filter(w => w.length >= 2);
      if (queryWords.length === 0) return { products: [], mode: 'general' };

      const [vectorResults, keywordResults] = await Promise.all([
        VectorSearchService.searchProducts(cleanQuery, tenantId, limit * 2).catch(() => [] as any[]),
        runKeywordSearch(cleanQuery, tenantId, limit * 2),
      ]);

      if (vectorResults.length === 0 && keywordResults.length === 0) {
        return { products: [], mode: 'general' };
      }

      if (vectorResults.length === 0) {
        return { products: keywordResults, mode: 'specific' };
      }

      const merged = VectorSearchService.rrfMerge(vectorResults, keywordResults, 60, limit);
      return { products: merged, mode: 'specific' };
    } catch (error: any) {
      console.error('❌ [SearchService Error]:', error.message);
      return { products: [], mode: 'general' };
    }
  }
}
