import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../../services/AIService.ts';
import { redis } from '../../config/redis.ts';

export async function suggestPrice(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { name, brand, markupPercentage = 15, size, basePrice } = req.body as {
      name: string;
      brand?: string;
      markupPercentage?: number;
      size?: string;
      basePrice?: number;
    };

    if (!name) {
      return reply.status(400).send({ error: 'Product name is required' });
    }

    console.log(`🧠 [AI Price Suggestion] Calculating price for: ${name} (Brand: ${brand || 'unknown'}), Size: ${size || 'default'}, Markup: ${markupPercentage}%`);

    const cacheKey = `ai_price_cache:${Buffer.from(name.trim().toLowerCase()).toString('base64')}:${markupPercentage}:${size || 'default'}:${basePrice || 0}`;

    // Check Redis Cache
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        console.log(`🚀 [Price Cache Hit] Returning cached price results for "${name}" (size: ${size || 'default'})`);
        return reply.status(200).send({ success: true, data: JSON.parse(cachedData) });
      }
    } catch (redisErr) {
      console.warn('Redis read failed for price suggestion', redisErr);
    }

    console.log(`🧠 [AI Price Suggestion Stage 1] Context-Aware price drafting with Gemini 3.1 Flash Lite for: ${name}`);

    const geminiDraftPrompt = `
You are a luxury perfume market price expert in Vietnam.
Analyze the perfume: "${name}" ${brand ? 'by brand "' + brand + '"' : ''} ${size ? 'for capacity/size "' + size + '"' : ''}.
The base price of the standard 100ml size of this perfume is ${basePrice ? basePrice + ' VNĐ' : 'unknown'}.

INSTRUCTIONS:
1. Determine a realistic authentic retail market price for this perfume/size in Vietnam in VNĐ.
   - If the size is a decant/sample (2ml, 5ml, 10ml):
     * It should be a reasonable portion of the standard price, but slightly higher per ml due to bottling and retail decant premium (e.g., if a 100ml bottle is 3,000,000 VNĐ, then 10ml is typically around 350,000 - 450,000 VNĐ, 5ml is around 200,000 - 250,000 VNĐ, 2ml is around 90,000 - 120,000 VNĐ).
   - If the size is standard/large (30ml, 50ml, 100ml, 150ml, 200ml) or default:
     * If the standard size base price is ${basePrice || '3,000,000'} VNĐ, then a 50ml bottle is usually about 60% to 70% of that standard price, and a 200ml bottle is usually about 160% to 180% of that standard price.
2. Calculate the boutique store markup price for L'essence premium store using a markup percentage of ${markupPercentage}%.
   - MarkupAmount = MarketPrice * (${markupPercentage} / 100).
   - SuggestedPrice = MarketPrice + MarkupAmount.
   - Round both MarkupAmount and SuggestedPrice to the nearest 10,000 VNĐ.
3. Provide a highly detailed market analysis in Vietnamese. You MUST strictly cover these exact 4 sections:
   - Các tiêu chí cốt lõi để AI gợi ý giá (Thuộc tính & trạng thái, Dữ liệu thị trường & Đối thủ, Lịch sử giao dịch thành công).
   - "Nguồn sản phẩm" đóng vai trò gì trong thuật toán (Độ uy tín & Xuất xứ, Chi phí logistics).
   - Tại sao AI phải đưa ra "Lý do gợi ý giá" (Tối ưu tốc độ, Cạnh tranh thị trường, Tình trạng hàng hóa).
   - Quyết định & Khuyến nghị mức Markup (${markupPercentage}%).

Respond with a raw draft containing all these numbers and a detailed market report draft in Vietnamese.
`;

    let geminiDraftOutput = '';
    try {
      geminiDraftOutput = await AIService.generateResponse(geminiDraftPrompt, undefined, 'gemini-3.1-flash-lite');
      console.log(`🧠 [AI Price Suggestion Stage 1] Gemini 3.1 Draft Completed successfully.`);
    } catch (geminiError: any) {
      console.warn(`⚠️ [AI Fallback] Gemini 3.1 Flash Lite is currently experiencing transient Google API issues (${geminiError.message}). Retrying...`);
      try {
        geminiDraftOutput = await AIService.generateResponse(geminiDraftPrompt, undefined, 'gemini-3.1-flash-lite');
        console.log(`🧠 [AI Price Suggestion Stage 1 Fallback] Gemini 3.1 Draft Completed successfully on retry.`);
      } catch (retryError: any) {
        console.error(`❌ [AI Error] Gemini 3.1 Flash Lite failed all attempts for Stage 1:`, retryError.message);
        throw retryError;
      }
    }

    console.log(`✨ [AI Price Suggestion Stage 2] Math Auditing & Refining with Gemini 3.1 Flash Lite...`);
    const geminiPrompt = `
You are an elite luxury perfume price analyst and JSON formatter.
You are given a draft market price report generated in the previous stage:

--- DRAFT MARKET REPORT FROM GEMINI 3.1 FLASH LITE ---
${geminiDraftOutput}
----------------------------------------

YOUR STRICT ASSIGNMENT:
1. Math Verification:
   - Extract or determine a realistic MarketPrice (e.g. 2,000,000 to 5,000,000 VNĐ).
   - Calculate precise MarkupAmount = MarketPrice * (${markupPercentage} / 100).
   - Calculate SuggestedPrice = MarketPrice + MarkupAmount.
   - Round both MarkupAmount and SuggestedPrice to the nearest 10,000 VNĐ.
2. Market Report Refinement:
   - Refine the explanation field in Vietnamese, making it extremely professional, detailed, and clear.
   - You MUST strictly format the explanation into these exact 4 sections using Markdown (bold headers and clear bullet points):

**1. Các tiêu chí cốt lõi để AI gợi ý giá:**
- **Thuộc tính và trạng thái của sản phẩm:** Phân tích cụ thể danh mục, thương hiệu "${brand || 'N/A'}" và thông số kỹ thuật dung tích "${size || 'mặc định'}".
- **Dữ liệu thị trường và Đối thủ:** Đánh giá mức độ khan hiếm, cung cầu hiện tại và yếu tố mùa vụ của mùi hương này tại Việt Nam.
- **Lịch sử giao dịch thành công:** Đánh giá độ ưa chuộng của người tiêu dùng thực tế đối với dòng này.

**2. "Nguồn sản phẩm" đóng vai trò gì trong thuật toán:**
- **Xác định độ uy tín & Xuất xứ:** Tác động của nguồn gốc nhập khẩu từ Pháp, Ý... của thương hiệu "${brand || 'N/A'}" đến giá trị cốt lõi.
- **Chi phí logistics:** Phân tích chi phí lưu kho, bảo quản nhiệt độ lạnh chuyên dụng và vận chuyển.

**3. Tại sao AI phải đưa ra "Lý do gợi ý giá":**
- **Lý do tối ưu tốc độ (Bán nhanh):** Đề xuất giá để đạt mức thanh khoản tối ưu nhất.
- **Lý do cạnh tranh thị trường:** Vị thế giá so với các đối thủ cùng phân khúc.
- **Lý do dựa trên tình trạng:** Định giá dựa trên chất lượng hàng mới/limited.

**4. Quyết định & Khuyến nghị mức Markup (${markupPercentage}%):**
- Đưa ra đánh giá chuyên môn sâu sắc về mức Markup ${markupPercentage}% hiện tại. Khuyên shop nên tăng lên (bao nhiêu %) để tối ưu lợi nhuận định vị cao cấp, giữ nguyên, hay chuyển sang giá trị âm (bán lỗ xả kho kích cầu) kèm theo lý giải cực kỳ chi tiết.

3. Output STRICTLY a valid JSON object matching the following schema (no markdown code blocks, no text outside the JSON):
{
  "marketPrice": number,
  "markupPercentage": number,
  "markupAmount": number,
  "suggestedPrice": number,
  "explanation": "string"
}
`;

    const response = await AIService.generateResponse(geminiPrompt, undefined, 'gemini-3.1-flash-lite');
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '');
    }

    try {
      const result = JSON.parse(cleaned.trim());

      // Save to Redis cache for 7 days
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 604800);
      } catch (redisErr) {
        console.warn('Redis write failed for price suggestion', redisErr);
      }

      return reply.status(200).send({ success: true, data: result });
    } catch (pErr) {
      console.warn('JSON Parse failed for price suggestion:', cleaned);

      // Fallback calculation in case JSON is malformed
      const fallbackMarketPrice = 3000000;
      const fallbackMarkupAmount = fallbackMarketPrice * (markupPercentage / 100);
      const fallbackSuggestedPrice = fallbackMarketPrice + fallbackMarkupAmount;

      const fallback = {
        marketPrice: fallbackMarketPrice,
        markupPercentage: markupPercentage,
        markupAmount: fallbackMarkupAmount,
        suggestedPrice: fallbackSuggestedPrice,
        explanation: 'Không thể phân tích dữ liệu AI. Giá mặc định thị trường: 3,000,000 VNĐ. Cộng thêm ' + markupPercentage + '% phí định vị thương hiệu.'
      };

      return reply.status(200).send({ success: true, data: fallback });
    }
  } catch (error: any) {
    console.error('AI Price Suggestion Error:', error);
    return reply.status(500).send({ success: false, message: error.message });
  }
}