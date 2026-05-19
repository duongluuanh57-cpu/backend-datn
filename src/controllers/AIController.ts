import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../services/AIService.ts';
import { SearchService } from '../services/SearchService.ts';
import { redisService } from '../services/RedisService.ts';
import { Knowledge } from '../models/Knowledge.ts';
import { redis } from '../config/redis.ts';
import { Product } from '../models/Product.ts';
import { Brand } from '../models/Brand.ts';
import { Tag } from '../models/Tag.ts';
import { ProductTaxonomy } from '../models/ProductTaxonomy.ts';

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

      // ── ADAPTIVE LEARNING: Phân tích lịch sử rating của phiên chat ─────────
      // Lấy tất cả tin nhắn assistant đã được đánh giá (có rating 1-5)
      const ratedMessages = messages.filter(
        (m: any) => m.role === 'assistant' && typeof m.rating === 'number'
      );

      // Chỉ xét 5 đánh giá gần nhất để phản ánh xu hướng thực tế nhất
      const recentRatings = ratedMessages.slice(-5).map((m: any) => m.rating as number);
      const avgRating = recentRatings.length > 0
        ? recentRatings.reduce((a: number, b: number) => a + b, 0) / recentRatings.length
        : null;

      // Đếm số lần rating thấp (≤ 2) liên tiếp gần nhất
      let consecutiveLow = 0;
      for (let i = ratedMessages.length - 1; i >= 0; i--) {
        if ((ratedMessages[i] as any).rating <= 2) consecutiveLow++;
        else break;
      }

      console.log(`📊 [Adaptive] avgRating=${avgRating?.toFixed(2) ?? 'N/A'}, consecutiveLow=${consecutiveLow}, samples=${recentRatings.length}`);

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
          ProductTaxonomy.find({ type: 'scent_group', status: 'active' }).select('name').lean(),
          ProductTaxonomy.find({ type: 'concentration', status: 'active' }).select('name').lean(),
          ProductTaxonomy.find({ type: 'segment', status: 'active' }).select('name').lean(),
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

      // 3. ADAPTIVE STYLE DIRECTIVE - tự điều chỉnh dựa trên lịch sử rating
      // Logic: AI không bao giờ biết số sao cụ thể — chỉ nhận hướng dẫn phong cách
      let adaptiveDirective = '';

      if (avgRating !== null) {
        if (consecutiveLow >= 2) {
          // ≥ 2 lần liên tiếp ≤ 2 sao: Chế độ khủng hoảng — thay đổi hoàn toàn cách tiếp cận
          adaptiveDirective = `
HƯỚNG DẪN THÍCH ỨNG (QUAN TRỌNG - ĐỌC KỸ):
Các phản hồi gần đây của bạn đã không đáp ứng được kỳ vọng của khách hàng.
Bạn PHẢI thay đổi hoàn toàn cách tiếp cận trong câu trả lời này:
- Hỏi lại xem khách đang cần gì chính xác hơn trước khi tư vấn sản phẩm.
- Dùng ngôn ngữ thật đơn giản, dễ hiểu, tránh thuật ngữ chuyên ngành.
- Trả lời từng bước, chia nhỏ thông tin thành danh sách bullet point.
- Cuối câu hỏi xem: "Mình hiểu đúng ý bạn chưa? 🙏".
- TUYỆT ĐỐI không trả lời dài dòng hay quá nhiều sản phẩm cùng lúc.
`;
        } else if (avgRating < 3.0) {
          // Trung bình thấp (< 3 sao): Cần cải thiện đáng kể
          adaptiveDirective = `
HƯỚNG DẪN THÍCH ỨNG:
Phản hồi gần đây chưa thực sự hữu ích cho khách hàng. Hãy điều chỉnh:
- Hỏi thêm một câu làm rõ nhu cầu nếu câu hỏi của khách còn mơ hồ.
- Trả lời cụ thể hơn, tránh câu trả lời chung chung.
- Đề xuất tối đa 2 sản phẩm thay vì nhiều lựa chọn gây rối.
- Kết thúc bằng: "Bạn muốn mình tư vấn thêm về điều gì không? 😊".
`;
        } else if (avgRating < 4.0) {
          // Trung bình (3-4 sao): Khá ổn, cần thêm chiều sâu
          adaptiveDirective = `
HƯỚNG DẪN THÍCH ỨNG:
Phản hồi đang ở mức chấp nhận được nhưng chưa xuất sắc. Hãy:
- Thêm một chi tiết cụ thể và hữu ích (ví dụ: lý do gợi ý, cảm nhận hương thơm).
- Cá nhân hóa câu trả lời hơn dựa trên ngữ cảnh cuộc trò chuyện.
`;
        } else {
          // Trung bình cao (≥ 4 sao): Đang làm tốt, duy trì
          adaptiveDirective = `
HƯỚNG DẪN THÍCH ỨNG:
Bạn đang làm rất tốt! Duy trì phong cách hiện tại — thân thiện, chính xác, và hữu ích.
`;
        }
      }

      // 4. SYSTEM PROMPT - TƯ VẤN ĐẦY ĐỦ + ADAPTIVE
      const systemPrompt = `
Bạn là Tinco - Trợ lý AI bán nước hoa cao cấp. Trả lời ngắn gọn, thân thiện, dùng icon :3.
QUY TẮC:
1. Nếu TRẠNG THÁI là "Khách vừa chào": Chỉ chào lại thân thiện, KHÔNG đề xuất sản phẩm, KHÔNG dùng [CARD:id].
2. Nếu khách hỏi cụ thể và có DANH SÁCH SẢN PHẨM KHỚP NHẤT: Ưu tiên tư vấn các sản phẩm này, BẮT BUỘC chép đúng mã [CARD:id] vào cuối câu.
3. Nếu khách hỏi tổng quát (ví dụ: shop có hãng nào, có bao nhiêu loại, có nhóm hương gì): Hãy đọc TỔNG QUAN TOÀN BỘ CƠ SỞ DỮ LIỆU CỬA HÀNG để trả lời chính xác, thay vì nói không biết.
4. KHÔNG bao giờ nhắc đến từ "Database", "Cơ sở dữ liệu", "Hệ thống".
${adaptiveDirective}
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
        availableGenders,
        availableSizes
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
        availableSizes?: string[];
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

LIST OF AVAILABLE SIZES/CAPACITIES IN OUR SYSTEM (YOU MUST USE ONLY THESE):
${JSON.stringify(availableSizes || ['2ml', '5ml', '10ml', '30ml', '50ml', '75ml', '100ml', '125ml', '150ml'])}

CRITICAL RULE FOR SIZES:
- You MUST ONLY use sizes from the "LIST OF AVAILABLE SIZES/CAPACITIES" above
- DO NOT create new sizes like "90ml" or any size not in the list
- Each size variant must have a corresponding price calculated proportionally

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
      const sizesJson = JSON.stringify(availableSizes || ['2ml', '5ml', '10ml', '30ml', '50ml', '75ml', '100ml', '125ml', '150ml']);
      const geminiPrompt = `
You are an elite luxury perfume editor and JSON formatter.
You are given the following draft profile of a perfume and market analysis reports generated in the previous stage:

--- DRAFT PROFILE & REPORTS FROM GEMINI 3.1 FLASH LITE ---
${geminiDraftOutput}
---------------------------------------------

YOUR STRICT ASSIGNMENT:
1. Fact-check the draft: Ensure the selected brand strictly belongs to the database brands list: ${brandsJson}. Do NOT output any brand name outside this list under any circumstances!

CRITICAL TAXONOMY SELECTION RULES (MUST FOLLOW EXACTLY):
You MUST select values from the existing database lists below. DO NOT create new values.

- **scentGroup**: MUST be EXACTLY ONE of these: ${JSON.stringify(availableScentGroups || [])}
  * If the draft suggests a scent group not in this list, find the CLOSEST MATCH from the list
  * Example: If draft says "Hương gỗ ấm áp" but list has "Hương gỗ", use "Hương gỗ"
  * Example: If draft says "Fresh Citrus" but list has "Hương cam chanh", use "Hương cam chanh"
  * NEVER create new scent groups

- **concentration**: MUST be EXACTLY ONE of these: ${JSON.stringify(availableConcentrations || [])}
  * If the draft suggests a concentration not in this list, find the CLOSEST MATCH from the list
  * Example: If draft says "Eau de Parfum Intense" but list has "Eau de Parfum", use "Eau de Parfum"
  * NEVER create new concentrations

- **segment**: MUST be EXACTLY ONE of these: ${JSON.stringify(availableSegments || [])}
  * If the draft suggests a segment not in this list, find the CLOSEST MATCH from the list
  * Example: If draft says "Cao cấp sang trọng" but list has "Cao cấp", use "Cao cấp"
  * NEVER create new segments

- **gender**: MUST be EXACTLY ONE of these: ${JSON.stringify(availableGenders || [])}
  * NO EXCEPTIONS - only use values from this list
  * If draft says "Nam giới", use "Nam"
  * If draft says "Nữ giới", use "Nữ"
  * If draft says "Unisex/Nam nữ đều dùng được", use "Unisex"

2. Scent Description: Ensure the "description" field is beautifully refined in Vietnamese and contains these three exact bold sections:
   - **Mô tả hương thơm:**
   - **Thông số kỹ thuật & Thuộc tính:**
   - **Nguồn gốc & Chế độ bảo hành:**

3. Pricing & Sizes:
   - Round suggested prices to the nearest 10,000 VNĐ.
   - CRITICAL SIZE RULE: You MUST ONLY use sizes from this exact list: ${sizesJson}
   - DO NOT create new sizes like "90ml" or any size not in the system
   - Read the draft capacity variants and their prices proposed in the draft. You MUST preserve ONLY the sizes that exist in the system list above (${sizesJson}). Format the "size" field strictly as a comma-separated list of "size:price" (e.g., "2ml:90000, 5ml:220000, 10ml:420000, 100ml:2900000"). 
   - If the draft suggests a size not in the system list, replace it with the closest available size from the list.

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

      // Convert taxonomy strings to ObjectIds
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      
      // Helper function to find best matching taxonomy (fuzzy match)
      const findBestMatchTaxonomy = async (name: string, type: 'scent_group' | 'concentration' | 'segment') => {
        // Lấy tất cả taxonomy của type này
        const allTaxonomies = await ProductTaxonomy.find({ tenantId, type, status: 'active' }).lean();
        
        if (allTaxonomies.length === 0) {
          console.warn(`⚠️ No ${type} found in database. Creating new one: ${name}`);
          const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const newTaxonomy = await ProductTaxonomy.create({ tenantId, type, name, slug, status: 'active' });
          return newTaxonomy._id;
        }
        
        // Chuẩn hóa tên để so sánh
        const normalizeName = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const normalizedInput = normalizeName(name);
        
        // Tìm exact match trước
        const exactMatch = allTaxonomies.find(t => normalizeName(t.name) === normalizedInput);
        if (exactMatch) {
          console.log(`✅ Exact match found for ${type}: "${name}" -> "${exactMatch.name}"`);
          return exactMatch._id;
        }
        
        // Nếu không có exact match, tìm partial match (contains)
        const partialMatch = allTaxonomies.find(t => 
          normalizeName(t.name).includes(normalizedInput) || 
          normalizedInput.includes(normalizeName(t.name))
        );
        
        if (partialMatch) {
          console.log(`⚠️ Partial match found for ${type}: "${name}" -> "${partialMatch.name}"`);
          return partialMatch._id;
        }
        
        // Nếu vẫn không tìm thấy, lấy taxonomy đầu tiên làm fallback
        console.warn(`⚠️ No match found for ${type}: "${name}". Using first available: "${allTaxonomies[0].name}"`);
        return allTaxonomies[0]._id;
      };

      // Convert scentGroup string to scentGroups array of ObjectIds
      if (productInfo.scentGroup && typeof productInfo.scentGroup === 'string') {
        const names = productInfo.scentGroup.split(',').map((s: string) => s.trim()).filter(Boolean);
        const matchedIds = await Promise.all(names.map((name: string) => findBestMatchTaxonomy(name, 'scent_group')));
        productInfo.scentGroups = matchedIds;
        
        // Lấy lại tên để trả về cho frontend
        const matchedTaxonomies = await ProductTaxonomy.find({ _id: { $in: matchedIds } }).lean();
        productInfo.scentGroup = matchedTaxonomies.map(t => t.name).join(', ');
      }

      // Convert concentration string to concentrations array of ObjectIds
      if (productInfo.concentration && typeof productInfo.concentration === 'string') {
        const names = productInfo.concentration.split(',').map((s: string) => s.trim()).filter(Boolean);
        const matchedIds = await Promise.all(names.map((name: string) => findBestMatchTaxonomy(name, 'concentration')));
        productInfo.concentrations = matchedIds;
        
        // Lấy lại tên để trả về cho frontend
        const matchedTaxonomies = await ProductTaxonomy.find({ _id: { $in: matchedIds } }).lean();
        productInfo.concentration = matchedTaxonomies.map(t => t.name).join(', ');
      }

      // Convert segment string to segments array of ObjectIds
      if (productInfo.segment && typeof productInfo.segment === 'string') {
        const names = productInfo.segment.split(',').map((s: string) => s.trim()).filter(Boolean);
        const matchedIds = await Promise.all(names.map((name: string) => findBestMatchTaxonomy(name, 'segment')));
        productInfo.segments = matchedIds;
        
        // Lấy lại tên để trả về cho frontend
        const matchedTaxonomies = await ProductTaxonomy.find({ _id: { $in: matchedIds } }).lean();
        productInfo.segment = matchedTaxonomies.map(t => t.name).join(', ');
      }

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
3. Language Control: Output strictly in 100% pure, standard Vietnamese (tiếng Việt). Absolutely NO Chinese characters (Hán tự), Sino-Chinese terms, or mixed languages.
4. Output STRICTLY a valid JSON object conforming to the schema below.
5. Do NOT include markdown code block syntax (like \`\`\`json). Just the raw JSON object.

JSON Schema:
{
  "origin": "Factually correct country of origin in Vietnamese",
  "description": "Exquisite, poetic story or taxonomy description in Vietnamese. 2-3 sentences."
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

  /**
   * POST /api/ai/feedback
   * Receives a star rating (1–5) from the user after an AI response.
   * The AI interprets the rating autonomously and streams an adaptive reply —
   * the user simply picks stars; all logic lives here on the server.
   *
   * Rating semantics (known only to the AI, not exposed to the frontend):
   *   5 ⭐ → Perfect — express genuine happiness, offer to help more
   *   4 ⭐ → Good but improvable — thank them, ask what can be better
   *   3 ⭐ → Neutral / mediocre — acknowledge, ask for specific feedback
   *   2 ⭐ → Poor — apologise sincerely, offer to retry or connect to support
   *   1 ⭐ → Very bad — apologise, express regret, escalate offer
   */
  static async handleFeedback(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { messageId, rating } = req.body as { messageId: string; rating: number };

      if (!rating || rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'Rating must be between 1 and 5' });
      }

      // Build a tailored system prompt based on the numeric rating.
      // The frontend never knows these rules — it only sends the star number.
      const ratingContext: Record<number, string> = {
        5: `Khách hàng vừa đánh giá câu trả lời của bạn 5 sao — hoàn hảo, tuyệt vời.
Hãy phản hồi với sự vui mừng chân thành, cảm ơn họ, và hỏi nhẹ nhàng xem bạn có thể giúp gì thêm không.
Dùng 1-2 câu ngắn, thân thiện, dùng icon nhẹ nhàng (ví dụ: ✨ 🌸).`,

        4: `Khách hàng vừa đánh giá câu trả lời của bạn 4 sao — tốt nhưng cần cải thiện.
Hãy cảm ơn họ chân thành, thừa nhận rằng bạn sẽ cố gắng hơn, và hỏi xem còn điều gì chưa ổn để bạn hỗ trợ tốt hơn.
Dùng 2-3 câu, giọng nhẹ nhàng, cầu thị, dùng icon gần gũi (ví dụ: 🙏 😊).`,

        3: `Khách hàng vừa đánh giá câu trả lời của bạn 3 sao — tạm được, không xuất sắc.
Hãy thừa nhận điều đó một cách khiêm tốn và hỏi khách muốn bạn điều chỉnh thêm điều gì.
Đừng quá xin lỗi, chỉ cần tỏ ra cởi mở, muốn cải thiện. 2-3 câu, dùng icon trung tính (😐 💬).`,

        2: `Khách hàng vừa đánh giá câu trả lời của bạn 2 sao — tệ.
Hãy xin lỗi thực sự, thừa nhận bạn chưa đáp ứng đúng nhu cầu của họ.
Đề nghị họ mô tả lại câu hỏi để bạn thử lại hoặc kết nối với hỗ trợ viên thực của L'essence.
2-3 câu, giọng thành thật, có trách nhiệm, icon phù hợp (😕 🙏).`,

        1: `Khách hàng vừa đánh giá câu trả lời của bạn 1 sao — rất tệ.
Đây là phản hồi nghiêm trọng. Hãy xin lỗi sâu sắc và chân thành nhất có thể.
Thừa nhận hoàn toàn rằng bạn đã thất bại trong việc hỗ trợ họ.
Cam kết sẽ cải thiện và đề nghị họ liên hệ trực tiếp với đội ngũ L'essence nếu cần hỗ trợ khẩn cấp.
2-4 câu, giọng nghiêm túc, có cảm xúc, icon phù hợp (😞 💔 🙏).`,
      };

      const systemPrompt = `
Bạn là Tinco - Trợ lý AI của L'essence. Bạn vừa nhận được đánh giá từ khách hàng.
${ratingContext[rating] || ratingContext[3]}

QUAN TRỌNG:
- KHÔNG đề cập đến số sao, điểm số hoặc bất kỳ con số đánh giá nào trong câu trả lời.
- KHÔNG giải thích cơ chế đánh giá.
- Phản hồi bằng tiếng Việt tự nhiên, ngắn gọn.
- Chỉ viết đúng phần phản hồi, không thêm tiêu đề hay lời dẫn.
      `.trim();

      const userPrompt = 'Phản hồi đánh giá này.';

      const streamMessages = [{ role: 'user', content: userPrompt }];
      const response = await AIService.createChatStream(streamMessages, systemPrompt);

      if (!response.body) throw new Error('No body from AI service');

      const origin = req.headers.origin || 'http://localhost:3000';
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache, no-transform',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      });

      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }

      reply.raw.end();
      return reply;
    } catch (error: any) {
      console.error('❌ [AIController.handleFeedback Error]:', error);
      if (!reply.sent && !reply.raw.headersSent) {
        return reply.status(500).send({ error: error.message || 'Internal Server Error' });
      }
      if (!reply.raw.writableEnded) reply.raw.end();
      return reply;
    }
  }

  /**
   * POST /api/ai/scan-gallery-image
   * Vision-based scanning for artistic moment album images.
   * Analyzes an uploaded image's mood, aesthetics, and theme, then auto-generates
   * romantic perfume titles and quotes in both Vietnamese and English.
   */
  static async scanGalleryImage(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { imageUrl } = req.body as { imageUrl: string };

      if (!imageUrl || typeof imageUrl !== 'string') {
        return reply.status(400).send({ success: false, error: 'imageUrl is required' });
      }

      console.log(`📸 [AIController] Scanning homepage gallery image: ${imageUrl.substring(0, 100)}...`);

      let base64Data = '';
      if (imageUrl.startsWith('data:image')) {
        base64Data = imageUrl;
      } else {
        try {
          const res = await fetch(imageUrl);
          if (!res.ok) throw new Error(`HTTP status ${res.status}`);
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
        } catch (fetchErr: any) {
          console.error(`❌ [AIController] Error fetching image from URL:`, fetchErr.message);
          return reply.status(400).send({ success: false, error: `Failed to fetch image URL: ${fetchErr.message}` });
        }
      }

      const prompt = `
You are an elite artistic copywriter and curator for a luxury niche perfume house named L'essence.
Analyze the provided image. Based on the mood, lighting, colors, objects (perfume bottles, flowers, silk, glass, nature, sunlight etc.) and artistic composition of the image:
1. Generate an evocative, extremely poetic, and highly artistic Title in Vietnamese matching the luxury aesthetic of the image (under 5 words). Examples: "Cánh Hồng Sương Sớm", "Giọt Nắng Pha Lê", "Hương Thảo Mộc Niche", "Khay Ngọc Kiêu Kỳ".
2. Generate an evocative, romantic, and philosophical perfume Quote/Statement in Vietnamese matching the title and image theme (under 15 words). Examples: "Sự lãng mạn ẩn mình trong từng nốt hương.", "Hương thơm là tiếng thì thầm của tâm hồn."
3. Translate or adapt the Vietnamese Title into an equally poetic and elegant Title in English (under 5 words). Examples: "Morning Dew Rose", "Crystal Sunlight", "Artisanal Niche", "Vanity Secrets".
4. Translate or adapt the Vietnamese Quote into an equally beautiful, elegant, and romantic perfume Quote/Statement in English (under 15 words). Examples: "Romance hidden in every single note.", "Scent is the whisper of the soul."

Output STRICTLY a valid JSON object matching the schema below. Do NOT include markdown code block syntax (like \`\`\`json). Just the raw JSON object.

JSON Schema:
{
  "titleVi": "artistic title in Vietnamese",
  "quoteVi": "artistic quote in Vietnamese",
  "titleEn": "artistic title in English",
  "quoteEn": "artistic quote in English"
}
      `.trim();

      const aiResponse = await AIService.identifyProduct(base64Data, prompt);
      
      let jsonString = aiResponse.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```json\s*/i, '').replace(/```$/, '');
      }

      const result = JSON.parse(jsonString.trim());
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      console.error('❌ [AIController.scanGalleryImage Error]:', error);
      return reply.status(500).send({ success: false, error: error.message || 'Internal Server Error' });
    }
  }
}

