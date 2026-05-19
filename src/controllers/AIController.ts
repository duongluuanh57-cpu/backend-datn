import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../services/AIService.ts';
import { SearchService } from '../services/SearchService.ts';
import { redisService } from '../services/RedisService.ts';
import { Knowledge } from '../models/Knowledge.ts';
import { redis } from '../config/redis.ts';
import { Product } from '../models/Product.ts';
import { Brand } from '../models/Brand.ts';
import { Tag } from '../models/Tag.ts';
import { ScentGroup } from '../models/ScentGroup.ts';
import { Concentration } from '../models/Concentration.ts';
import { Segment } from '../models/Segment.ts';

export class AIController {
  /**
   * POST /api/ai/chat
   * Chat Stream Pipeline - Mood-Aware Expert Version
   */
  static async chatStream(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { messages, image } = req.body as { messages: any[], image?: string };
      const tenantId = (req as any).user?.tenantId || 'default-tenant';

      if ((!messages || !Array.isArray(messages)) && !image) {
        return reply.status(400).send({ error: 'Messages or Image required' });
      }

      const recentMessages = messages.slice(-5);
      const lastMessage = recentMessages[recentMessages.length - 1]?.content || (image ? 'User uploaded an image' : '');
      if (!lastMessage) throw new Error('Empty message');

      const cleanQuestion = lastMessage.trim().toLowerCase();

      // 1. CACHE DISABLED
      const cacheKey = `ai:chat:${tenantId}:${Buffer.from(cleanQuestion).toString('base64')}`;

      // 2. TRUY XUẤT TRI THỨC (Nâng cấp: Nếu có ảnh, nhận diện trước khi tìm)
      let searchQuery = lastMessage;
      let products: any[] = [];
      let mode: string = '';

      try {
        // Nếu có ảnh, hỏi AI xem đây là gì để tìm cho chính xác
        if (image) {
          console.log(`📸 [AIController] Đã nhận ảnh (Size: ${image.length} chars)`);
          try {
            const identifyPrompt = "Hãy đọc tên sản phẩm nước hoa và thương hiệu trong ảnh này. Chỉ trả về tên, ví dụ: 'Midnight Rose'.";
            const identifiedProduct = await AIService.identifyProduct(image, identifyPrompt);
            console.log('👁️ [AIController] Vision Result:', identifiedProduct);

            if (identifiedProduct && identifiedProduct.trim()) {
              searchQuery = `${lastMessage} ${identifiedProduct.trim()}`;
            }
          } catch (vErr) {
            console.error('❌ [Vision Identify Error]:', vErr);
          }
        }

        console.log('📝 [AIController] Final Search Query:', searchQuery);
        const result = await SearchService.hybridSearch(searchQuery, tenantId, 4);
        products = result.products;
        mode = result.mode;
      } catch (err) {
        console.error('❌ [Search Error]:', err);
      }

      let context = '';
      if (mode === 'greeting') {
        context = "TRẠNG THÁI: Khách vừa chào. Chỉ chào lại thân thiện, KHÔNG đề xuất sản phẩm.\n";
      } else if (products.length === 0) {
        context = "TRẠNG THÁI: Không tìm thấy sản phẩm phù hợp. Xin lỗi lịch sự.\n";
      } else {
        context = `DANH SÁCH SẢN PHẨM KHỚP NHẤT:\n${products.map(p => `- ${p.name} (Hãng: ${p.brand}): [CARD:${p._id}]`).join('\n')}\n`;
      }

      let globalInfo = '';
      try {
        const [allBrands, allTags, allScents, allConcentrations, allSegments, allProducts] = await Promise.all([
          Brand.find({ status: 'active' }).select('name').lean(),
          Tag.find({ status: 'active' }).select('name').lean(),
          ScentGroup.find().select('name').lean(),
          Concentration.find().select('name').lean(),
          Segment.find().select('name').lean(),
          Product.find({}).select('name brand').lean()
        ]);
        globalInfo = `TỔNG QUAN TOÀN BỘ CƠ SỞ DỮ LIỆU CỬA HÀNG (Dùng để trả lời nếu khách hỏi tổng quát):
- Thương hiệu đang có: ${allBrands.map((b: any) => b.name).join(', ')}
- Nhãn Tags: ${allTags.map((t: any) => t.name).join(', ')}
- Nhóm hương: ${allScents.map((s: any) => s.name).join(', ')}
- Nồng độ: ${allConcentrations.map((c: any) => c.name).join(', ')}
- Phân khúc: ${allSegments.map((s: any) => s.name).join(', ')}
- TOÀN BỘ SẢN PHẨM TRONG KHO: ${allProducts.map((p: any) => `${p.name} (${p.brand})`).join(' | ')}`;
      } catch (dbErr) {
        console.error('Error fetching global info:', dbErr);
      }

      // 3. SYSTEM PROMPT - TƯ VẤN ĐẦY ĐỦ
      const systemPrompt = `
Bạn là Tinco - Trợ lý AI bán nước hoa cao cấp. Trả lời ngắn gọn, thân thiện, dùng icon :3.
QUY TẮC:
1. Nếu TRẠNG THÁI là "Khách vừa chào": Chỉ chào lại thân thiện, KHÔNG đề xuất sản phẩm, KHÔNG dùng [CARD:id].
2. Nếu khách hỏi cụ thể và có DANH SÁCH SẢN PHẨM KHỚP NHẤT: Ưu tiên tư vấn các sản phẩm này, BẮT BUỘC chép đúng mã [CARD:id] vào cuối câu.
3. Nếu khách hỏi tổng quát (ví dụ: shop có hãng nào, có bao nhiêu loại, có nhóm hương gì): Hãy đọc TỔNG QUAN TOÀN BỘ CƠ SỞ DỮ LIỆU CỬA HÀNG để trả lời chính xác, thay vì nói không biết.
4. KHÔNG bao giờ nhắc đến từ "Database", "Cơ sở dữ liệu", "Hệ thống".

DỮ LIỆU TÌM KIẾM CỤ THỂ:
${context}

${globalInfo}
      `;

      const response = await AIService.createChatStream(recentMessages, systemPrompt, image);
      if (!response.body) throw new Error('No body');

      const origin = req.headers.origin || 'http://localhost:3000';
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache, no-transform',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true'
      });

      const reader = response.body.getReader();
      let fullResponseText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        fullResponseText += chunk;
        reply.raw.write(value);
      }

      // 4. LƯU VĨNH VIỄN
      if (fullResponseText.trim() && !fullResponseText.includes('NULL')) {
        await Promise.all([
          redisService.set(cacheKey, fullResponseText),
          Knowledge.findOneAndUpdate(
            { question: cleanQuestion, tenantId },
            { answer: fullResponseText },
            { upsert: true }
          )
        ]);
      }

      reply.raw.end();
      return reply;
    } catch (error: any) {
      console.error('❌ [AIController Error]:', error);
      if (!reply.sent && !reply.raw.headersSent) {
        return reply.status(500).send({ error: error.message || 'Internal Server Error' });
      }
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
      return reply;
    }
  }

  static async supportChat(req: FastifyRequest, reply: FastifyReply) {
    return this.chatStream(req, reply);
  }

  static async generate(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { prompt } = req.body as { prompt: string };
      const response = await AIService.generateResponse(prompt);
      return reply.status(200).send({ success: true, data: response });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async generateProduct(req: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        name,
        brand,
        price,
        size,
        description,
        tag,
        quantityInStock,
        discountPercentage,
        metaTitle,
        metaDescription,
        keywords,
        image,
        availableBrands,
        availableScentGroups,
        availableConcentrations,
        availableSegments,
        availableGenders
      } = req.body as {
        name: string;
        brand?: string;
        price?: number;
        size?: string;
        description?: string;
        tag?: string;
        quantityInStock?: number;
        discountPercentage?: number;
        metaTitle?: string;
        metaDescription?: string;
        keywords?: string;
        image?: string;
        availableBrands?: string[];
        availableScentGroups?: string[];
        availableConcentrations?: string[];
        availableSegments?: string[];
        availableGenders?: string[];
      };

      if (!name) return reply.status(400).send({ error: 'Name is required' });

      // Build context of pre-filled fields to assist prompt guidance, preserving stock strictly
      const preFilled: Record<string, any> = {};
      if (brand && brand.trim()) preFilled.brand = brand.trim();
      if (price && price > 0) preFilled.price = price;
      if (size && size.trim()) preFilled.size = size.trim();
      if (description && description.trim()) preFilled.description = description.trim();
      if (tag && tag.trim()) preFilled.tag = tag.trim();
      if (quantityInStock && quantityInStock > 0) preFilled.quantityInStock = quantityInStock;
      if (discountPercentage && discountPercentage > 0) preFilled.discountPercentage = discountPercentage;
      if (metaTitle && metaTitle.trim()) preFilled.metaTitle = metaTitle.trim();
      if (metaDescription && metaDescription.trim()) preFilled.metaDescription = metaDescription.trim();
      if (keywords && keywords.trim()) preFilled.keywords = keywords.trim();
      if (image && image.trim()) preFilled.image = image.trim();

      console.log(`🧠 [AI Workflow Stage 1] Re-engineered details generation with Gemini 3.1 Flash Lite for: ${name}`);

      const geminiDraftPrompt = `
You are an elite luxury perfume market price and catalog generator with deep research skills.
Generate a comprehensive profile for the perfume named "${name}".

LIST OF AVAILABLE BRANDS EXISTING IN OUR DATABASE:
${JSON.stringify(availableBrands || [])}

INSTRUCTIONS:
1. Ensure the product name is provided (already validated). Generate only the product name and select a matching brand from the database brand list.
2. Suggest an optimal standard retail Selling Price (Giá bán) in VNĐ for the standard size (e.g., 2,000,000 to 5,500,000 VNĐ).
3. Provide a highly professional fragrance description written poetically in standard Vietnamese, divided into three bold headings:
   - **Mô tả hương thơm:**
   - **Thông số kỹ thuật & Thuộc tính:**
   - **Nguồn gốc & Chế độ bảo hành:**
4. Include SEO metadata (meta title under 60 chars, meta description under 160 chars in Vietnamese, and 5 keywords).
Note: Capacity/size variants and Discount Percentage will be generated in a later step after price confirmation.
4. For the three suggested numerical fields (Selling Price, Capacity Variants, and Discount Percentage), you MUST research and cite real-world international references and websites (such as Fragrantica, Basenotes, Sephora, Harrods, Selfridges, or official designer/niche house websites like Chanel, Dior, Creed, Le Labo, Tom Ford etc.) and draft extremely rich, highly specific Vietnamese market analysis reports:
   - Price Decision Report (Báo cáo giải thích giá bán): Cover these exact sections with rich, long-form details:
     * **1. Các tiêu chí cốt lõi để AI gợi ý giá:** (Detailed olfactory raw materials rarity, global scent index e.g. Fragrantica score, successful local transaction records).
     * **2. "Nguồn sản phẩm" đóng vai trò gì trong thuật toán:** (Official distribution vs grey market price differences, safe airfreight logistic costs).
     * **3. Tại sao AI phải đưa ra "Lý do gợi ý giá":** (Liquidity/velocity vs premium exclusivity trade-off, competitive advantages).
     * **4. Quyết định & Khuyến nghị mức Markup (15%):** (Markup margin logic tailored to this brand).
     * **5. Nguồn tham khảo & Đối chiếu của Gemini 3.1 Flash Lite:** (List exact websites, department stores, and catalog indexes consulted for this specific brand/perfume).
   - Capacity Decision Report (Báo cáo giải thích dung tích): Cover 5 detailed sections explaining sizing options, portion pricing logic, decant/sample bottling costs, local customer sizing behaviors in Vietnam, and the specific references consulted.
   - Discount Decision Report (Báo cáo giải thích chiết khấu): Cover 5 detailed sections explaining the suggested discount percentage, competitor promo levels, seasonal factors, retail margins optimization, and the specific references consulted.

LANGUAGE REQUIREMENT:
- You MUST write and describe strictly in pure, standard Vietnamese (tiếng Việt).
- Absolutely NO Chinese characters (Hán tự), mixed Chinese-Vietnamese text, or any other languages are allowed.

Respond with a raw draft containing all these details and reports.
`;

      let geminiDraftOutput = '';
      try {
        geminiDraftOutput = await AIService.generateResponse(geminiDraftPrompt, undefined, 'gemini-3.1-flash-lite');
        console.log(`🧠 [AI Workflow Stage 1] Gemini 3.1 Flash Lite Draft Completed successfully.`);
      } catch (geminiError: any) {
        console.warn(`⚠️ [AI Fallback] Gemini 3.1 Flash Lite is currently experiencing transient Google API issues (${geminiError.message}). Retrying...`);
        try {
          geminiDraftOutput = await AIService.generateResponse(geminiDraftPrompt, undefined, 'gemini-3.1-flash-lite');
          console.log(`🧠 [AI Workflow Stage 1 Fallback] Gemini 3.1 Draft Completed successfully on retry.`);
        } catch (retryError: any) {
          console.error(`❌ [AI Error] Gemini 3.1 Flash Lite failed all attempts for Stage 1:`, retryError.message);
          throw retryError;
        }
      }

      console.log(`✨ [AI Workflow Stage 2] Refining and Auditing with Gemini 3.1 Flash Lite...`);
      console.log(`🔍 [AIController Stage 2 Pre-Check] Variables check:`, {
        geminiDraftOutput_type: typeof geminiDraftOutput,
        geminiDraftOutput_val: String(geminiDraftOutput).substring(0, 100),
        availableBrands_type: typeof availableBrands,
        availableBrands_val: availableBrands
      });
      
      // Validate geminiDraftOutput
      if (!geminiDraftOutput || typeof geminiDraftOutput !== 'string') {
        throw new Error(`Invalid geminiDraftOutput: ${typeof geminiDraftOutput}`);
      }
      
      const brandsJson = JSON.stringify(availableBrands || []);
      const geminiPrompt = `
You are an elite luxury perfume editor and JSON formatter.
You are given the following draft profile of a perfume and market analysis reports generated in the previous stage:

--- DRAFT PROFILE & REPORTS FROM GEMINI 3.1 FLASH LITE ---
${geminiDraftOutput}
---------------------------------------------

YOUR STRICT ASSIGNMENT:
1. Fact-check the draft: Ensure the selected brand strictly belongs to the database brands list: ${brandsJson}. Do NOT output any brand name outside this list under any circumstances!
CRITICAL TAXONOMY RULES: To prevent database bloat, you MUST strongly prioritize selecting exact string matches from the provided lists below. ONLY IF there is absolutely no fitting category in the list, you may suggest a short, highly accurate new category string (except for gender).
- scentGroup: Prioritize exactly one of ${JSON.stringify(availableScentGroups || [])}. Suggest a new one ONLY if no match exists.
- concentration: Prioritize exactly one of ${JSON.stringify(availableConcentrations || [])}. Suggest a new one ONLY if no match exists.
- segment: Prioritize exactly one of ${JSON.stringify(availableSegments || [])}. Suggest a new one ONLY if no match exists.
- gender: MUST be exactly one of ${JSON.stringify(availableGenders || [])}. Do NOT invent new genders.

2. Scent Description: Ensure the "description" field is beautifully refined in Vietnamese and contains these three exact bold sections:
   - **Mô tả hương thơm:**
   - **Thông số kỹ thuật & Thuộc tính:**
   - **Nguồn gốc & Chế độ bảo hành:**

3. Pricing & Sizes:
   - Round suggested prices to the nearest 10,000 VNĐ.
   - Read the draft capacity variants and their prices proposed in the draft. You MUST preserve the exact sizes (such as 2ml, 5ml, 10ml, 50ml, 100ml, etc. as analyzed and explained in the draft and sizeReport) and their calculated prices. Format the "size" field strictly as a comma-separated list of "size:price" (e.g., "2ml:90000, 5ml:220000, 10ml:420000, 100ml:2900000"). Do NOT hardcode or default to other sizes.

4. Detailed Analysis Reports (CRITICAL - MUST BE COMPREHENSIVE):
   
   **priceReport** - Phân tích chi tiết về giá sản phẩm (tiếng Việt, 300-500 từ):
   - **1. Các tiêu chí cốt lõi để AI gợi ý giá:** Giải thích cách AI phân tích thương hiệu, độ hiếm, nồng độ hương, nguồn gốc nguyên liệu để đưa ra mức giá phù hợp
   - **2. "Nguồn sản phẩm" đóng vai trò gì trong thuật toán:** Phân tích sự khác biệt giữa hàng chính hãng, parallel import, tester về giá và chất lượng
   - **3. So sánh giá với các sản phẩm tương tự:** So sánh với 2-3 sản phẩm cùng phân khúc, giải thích tại sao giá này hợp lý
   - **4. Dự đoán xu hướng giá:** Phân tích khả năng tăng/giảm giá trong 6-12 tháng tới dựa trên thị trường
   
   **sizeReport** - Phân tích chi tiết về dung tích (tiếng Việt, 300-500 từ):
   - **1. Tại sao có nhiều dung tích khác nhau:** Giải thích chiến lược phân khúc khách hàng (thử nghiệm, sử dụng hàng ngày, sưu tầm)
   - **2. Phân tích giá trị từng dung tích:** So sánh giá/ml của từng size, tư vấn size nào cost-effective nhất
   - **3. Xu hướng tiêu dùng theo dung tích:** Phân tích size nào phổ biến nhất ở thị trường Việt Nam và tại sao
   - **4. Khuyến nghị cho từng đối tượng:** Tư vấn size phù hợp cho người mới dùng, người sưu tầm, người dùng thường xuyên
   
   **discountReport** - Phân tích chi tiết về chiết khấu (tiếng Việt, 300-500 từ):
   - **1. Cơ sở đưa ra mức chiết khấu:** Giải thích tại sao sản phẩm này được giảm giá X% (mùa vụ, thanh lý, khuyến mãi đặc biệt)
   - **2. So sánh với các đợt sale trước:** Phân tích lịch sử giảm giá của thương hiệu/dòng sản phẩm này
   - **3. Đánh giá mức độ hấp dẫn:** So sánh với mức giảm giá trung bình của thị trường (10-15% là bình thường, >20% là tốt)
   - **4. Thời điểm tốt nhất để mua:** Tư vấn nên mua ngay hay chờ đợt sale lớn hơn (Black Friday, Tết, v.v.)

5. Output STRICTLY a valid JSON object conforming to the schema below. Do NOT include markdown code block syntax (like \`\`\`json). Just the raw JSON object.

JSON Schema:
{
  "brand": "Factually correct brand name strictly selected from the database brand list",
  "tag": "one of: 'New', 'Sale', 'Trending', 'Limited', 'Standard'",
  "scentGroup": "Strictly selected from the database scent groups list",
  "concentration": "Strictly selected from the database concentrations list",
  "segment": "Strictly selected from the database segments list",
  "gender": "Strictly selected from the gender list",
  "description": "Poetic fragrance description with three bold sections in Vietnamese",
  "price": number (rounded to nearest 10,000 VNĐ),
  "size": "comma-separated list of capacity:price variants as analyzed in the sizeReport (e.g. '2ml:100000, 5ml:220000, 10ml:420000, 100ml:2900000')",
  "discountPercentage": number (integer e.g., 10 or 15 or 20),
  "priceReport": "Detailed price report in Vietnamese with bold section headers",
  "sizeReport": "Detailed size report in Vietnamese with bold section headers",
  "discountReport": "Detailed discount report in Vietnamese with bold section headers",
  "metaTitle": "SEO title under 60 chars in Vietnamese",
  "metaDescription": "SEO desc under 160 chars in Vietnamese",
  "keywords": ["keyword 1", "keyword 2", "keyword 3"]
}
`;
      console.log(`🔍 [AIController DEBUG] About to call generateResponse with geminiPrompt:`, {
        type: typeof geminiPrompt,
        isNull: geminiPrompt === null,
        isUndefined: geminiPrompt === undefined,
        isNaN: typeof geminiPrompt === 'number' && isNaN(geminiPrompt),
        valueStr: String(geminiPrompt).substring(0, 100),
        length: typeof geminiPrompt === 'string' ? geminiPrompt.length : 'N/A'
      });

      const response = await AIService.generateResponse(geminiPrompt, undefined, 'gemini-3.1-flash-lite');
      let jsonString = response.trim();

      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```json\s*/i, '').replace(/```$/, '');
      }

      const productInfo = JSON.parse(jsonString.trim());

      const presetImages = [
        'https://i.ibb.co/LhJhpsKs/Midnight-Rose-copy.webp',
        'https://i.ibb.co/6cQSVbRX/Simple-Product-Golden-Amber.webp',
        'https://i.ibb.co/gH9dMN4/26689197.webp',
        'https://i.ibb.co/4wB9f8mn/Royal-Blue-Musk-scaled.webp'
      ];
      // Keep preFilled.image if user has already uploaded one, otherwise pick a preset or allow empty/generation!
      productInfo.image = preFilled.image || presetImages[Math.floor(Math.random() * presetImages.length)];

      console.log(`%c✨ [AI Workflow Stage 2] Gemini 3.1 Audit & Formatting Completed!`, 'color: green');
      return reply.status(200).send({ success: true, data: productInfo });
    } catch (error: any) {
      console.error('AI Product Generation Error:', error);
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async generateBrand(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = req.body as { name: string };
      if (!name) return reply.status(400).send({ error: 'Name is required' });

      console.log(`🧠 [AI Workflow] Generating brand/tag details directly with Gemini 3.1 Flash Lite for: ${name}`);
      const geminiPrompt = `
You are an elite luxury brand and taxonomy editor.
Write a detailed historical record, description, and country of origin of the luxury fragrance brand or taxonomy group named "${name}".

Your tasks:
1. True Country of Origin: Suggest the factually correct country of origin (e.g., Chanel -> "Pháp", Gucci -> "Ý", Jo Malone -> "Vương quốc Anh", Tom Ford -> "Mỹ").
2. Exquisite Story/Description: Write a highly elegant, high-end, smooth, and professional brand story or classification description in Vietnamese. 2-3 sentences.
3. Target Gender: Suggest the correct target gender for the brand's primary catalogs (e.g., "Nam, Nữ, Unisex", "Unisex", "Nam", "Nữ").
4. Signature Scent Groups: List signature perfume scent groups of the brand in Vietnamese (e.g., "Hương hoa cỏ Phương Đông (Floral Oriental)", "Hương Gỗ cay nồng", "Chypre").
5. Common Concentrations: List common perfume concentrations the brand produces (e.g., "EDP, EDT, Cologne, Parfum").
6. Brand Classification Group: Factually correct segment of the brand (e.g., "Niche", "Designer", "Indie").
7. Language Control: Output strictly in 100% pure, standard Vietnamese (tiếng Việt). Absolutely NO Chinese characters (Hán tự), Sino-Chinese terms, or mixed languages.
8. Output STRICTLY a valid JSON object conforming to the schema below.
9. Do NOT include markdown code block syntax (like \`\`\`json). Just the raw JSON object.

JSON Schema:
{
  "origin": "Factually correct country of origin in Vietnamese",
  "description": "Exquisite, poetic story or taxonomy description in Vietnamese. 2-3 sentences.",
  "gender": "Giới tính phù hợp cho thương hiệu (e.g., Nam, Nữ, Unisex)",
  "scentGroup": "Nhóm hương đặc trưng nổi tiếng nhất của hãng",
  "concentration": "Nồng độ nước hoa chủ đạo (e.g., EDP, EDT, Parfum)",
  "group": "Phân loại phân khúc thương hiệu (e.g., Niche, Designer, Classic)"
}
`;

      const response = await AIService.generateResponse(geminiPrompt, undefined, 'gemini-3.1-flash-lite');
      let jsonString = response.trim();

      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```json\s*/i, '').replace(/```$/, '');
      }

      const brandInfo = JSON.parse(jsonString.trim());

      // Limit brand fields exactly as requested
      brandInfo.logo = '';
      brandInfo.status = 'active';
      brandInfo.featured = false;

      console.log(`✨ [AI Workflow] Gemini 3.1 Brand/Tag Generation Completed!`);
      return reply.status(200).send({ success: true, data: brandInfo });
    } catch (error: any) {
      console.error('AI Brand/Tag Generation Error:', error);
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async runAgent(req: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({ success: true });
  }

  static async autocomplete(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { field, currentValue, context } = req.body as {
        field: string;
        currentValue: string;
        context?: any;
      };

      if (!field || !currentValue) {
        return reply.status(400).send({ error: 'Field and currentValue are required' });
      }

      // Generate a cache key based on the field and prefix
      const cleanVal = currentValue.trim().toLowerCase();
      const cacheKey = `ai_autocomplete_cache:${field}:${Buffer.from(cleanVal).toString('base64')}`;

      // Check Redis Cache
      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          console.log(`🚀 [Autocomplete Cache Hit] Returning cached results for prefix "${currentValue}"`);
          return reply.status(200).send({ success: true, data: JSON.parse(cachedData) });
        }
      } catch (redisErr) {
        console.warn('Redis read failed for autocomplete', redisErr);
      }

      console.log(`🧠 [AI Autocomplete] Generating suggestions for field: ${field}, value: "${currentValue}"`);

      let systemPrompt = '';
      if (field === 'name') {
        systemPrompt = `
Suggest 3 luxury perfume names continuing: "${currentValue}".
Return exactly 3 lines, one suggestion per line. No markdown, no numbers.
Example:
Sweet Vanilla Bourbon
Sweet Violet Oud
Sweet Amber Nights
`;
      } else if (field === 'description') {
        const prodName = context?.name || '';
        systemPrompt = `
For perfume: "${prodName}".
Based on: "${currentValue}", suggest 3 poetic next-word/sentence Vietnamese completions.
Return exactly 3 lines, one suggestion per line. No markdown, no numbers.
Example:
mang lại cảm giác ấm áp quyến rũ
là sự hòa quyện của ngọt ngào
đưa bạn vào cuộc hành trình lãng mạn
`;
      } else if (field === 'keywords') {
        systemPrompt = `
Suggest 3 SEO keywords continuing: "${currentValue}".
Return exactly 3 lines, one suggestion per line. No markdown, no numbers.
Example:
nước hoa chính hãng
nhóm hương ngọt ngào
nước hoa nam quyến rũ
`;
      } else {
        systemPrompt = `
Suggest 3 completions continuing: "${currentValue}".
Return exactly 3 lines, one suggestion per line. No markdown, no numbers.
`;
      }

      // Generate response from Gemini (extremely fast now, as it only generates 3 plain text lines)
      const response = await AIService.generateResponse(systemPrompt, undefined, 'gemini-3.1-flash-lite');

      // Clean up response line-by-line using a regex that handles list marks, bullets, quotes, and brackets
      const suggestions = response.split('\n')
        .map(s => s.replace(/^[-\d.\s"'`*•\[\]]+/, '').replace(/["'`*\]\[]+$/, '').trim())
        .filter(Boolean)
        .slice(0, 3);

      // Save to Redis cache for 7 days
      try {
        await redis.set(cacheKey, JSON.stringify(suggestions), 'EX', 604800);
      } catch (redisErr) {
        console.warn('Redis write failed for autocomplete', redisErr);
      }

      return reply.status(200).send({ success: true, data: suggestions });
    } catch (error: any) {
      console.error('AI Autocomplete Error:', error);
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async suggestPrice(req: FastifyRequest, reply: FastifyReply) {
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
Analyze the perfume: "${name}" ${brand ? `by brand "${brand}"` : ''} ${size ? `for capacity/size "${size}"` : ''}.
The base price of the standard 100ml size of this perfume is ${basePrice ? `${basePrice} VNĐ` : 'unknown'}.

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
          explanation: `Không thể phân tích dữ liệu AI. Giá mặc định thị trường: 3,000,000 VNĐ. Cộng thêm ${markupPercentage}% phí định vị thương hiệu.`
        };

        return reply.status(200).send({ success: true, data: fallback });
      }
    } catch (error: any) {
      console.error('AI Price Suggestion Error:', error);
      return reply.status(500).send({ success: false, message: error.message });
    }
  }
}
