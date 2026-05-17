import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

export class SearchService {
  /**
   * Hybrid Search - Sửa lỗi Keywords là mảng
   */
  static async hybridSearch(query: string, tenantId: string, limit: number = 4) {
    const logPath = path.join(process.cwd(), 'search_debug.log');
    const timestamp = new Date().toISOString();
    
    try {
      const db = mongoose.connection.db;
      if (!db) return { products: [], docs: [], mode: 'specific', brands: [] };

      const cleanQuery = query.toLowerCase().trim();
      fs.appendFileSync(logPath, `[${timestamp}] 🔍 Search Query: "${cleanQuery}"\n`);

      // Phát hiện greeting (chào hỏi) - KHÔNG đề xuất sản phẩm
      const greetingPatterns = [
        /^(xin )?chào/i,
        /^hi+$/i,
        /^hello+$/i,
        /^hey+$/i,
        /^good (morning|afternoon|evening)/i,
        /^(chúc )?buổi (sáng|chiều|tối)/i,
        /^(bạn|mình) (có )?khỏe/i,
        /^(có ai|ai đó) (ở đây|không)/i,
        /^(cảm ơn|thanks|thank you)/i,
        /^tạm biệt|bye|goodbye/i
      ];

      const isGreeting = greetingPatterns.some(pattern => pattern.test(cleanQuery));
      
      if (isGreeting) {
        fs.appendFileSync(logPath, `[${timestamp}] 👋 Detected GREETING - No product suggestions\n\n`);
        return { products: [], docs: [], mode: 'greeting', brands: [] };
      }

      const allProducts = await db.collection('products').find({}).toArray();
      
      // Tìm kiếm thông minh hơn
      const queryWords = cleanQuery.split(/\s+/).filter(w => w.length >= 2);
      
      const matchedProducts = allProducts.filter(p => {
        const name = (p.name || "").toLowerCase();
        const brand = (p.brand || "").toLowerCase();
        
        // Xử lý Keywords (có thể là mảng hoặc chuỗi)
        let keywordsStr = "";
        if (Array.isArray(p.keywords)) {
          keywordsStr = p.keywords.join(" ").toLowerCase();
        } else if (typeof p.keywords === 'string') {
          keywordsStr = p.keywords.toLowerCase();
        }

        return queryWords.some(word => 
          name.includes(word) || 
          brand.includes(word) || 
          keywordsStr.includes(word)
        );
      });

      fs.appendFileSync(logPath, `[${timestamp}] ✅ Found: ${matchedProducts.length} items\n\n`);

      if (matchedProducts.length === 0) {
        return { 
          products: allProducts.slice(0, limit), 
          docs: [], 
          mode: 'general', 
          brands: [] 
        };
      }

      return { 
        products: matchedProducts.slice(0, limit), 
        docs: [], 
        mode: 'specific', 
        brands: [] 
      };
      
    } catch (error: any) {
      fs.appendFileSync(logPath, `[${timestamp}] ❌ Error at Search: ${error.message}\n\n`);
      return { products: [], docs: [], mode: 'general', brands: [] };
    }
  }
}
