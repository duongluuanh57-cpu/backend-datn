import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../services/AIService.ts';
import { SearchService } from '../services/SearchService.ts';
import { redisService } from '../services/RedisService.ts';
import { Knowledge } from '../models/Knowledge.ts';
import { redis } from '../config/redis.ts';

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
        context = `DANH SÁCH SẢN PHẨM:\n${products.map(p => `- ${p.name} (Hãng: ${p.brand}): [CARD:${p._id}]`).join('\n')}\n`;
      }

      // 3. SYSTEM PROMPT - TƯ VẤN ĐẦY ĐỦ
      const systemPrompt = `
Bạn là Tinco. Trả lời dưới 30 từ, dùng icon :3 thân thiện.
QUY TẮC:
1. Nếu TRẠNG THÁI là "Khách vừa chào": Chỉ chào lại thân thiện, KHÔNG đề xuất sản phẩm, KHÔNG dùng [CARD:id].
2. Nếu có DANH SÁCH SẢN PHẨM: Luôn nêu rõ Tên sản phẩm và Thương hiệu, BẮT BUỘC chép đúng mã [CARD:id] vào cuối câu.
3. Nếu không có sản phẩm: Xin lỗi ngắn gọn, đề xuất hỏi cách khác.

DỮ LIỆU:
${context}
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
        availableBrands
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
        availableBrands?: string[];
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

      console.log(`🧠 [AI Workflow Stage 1] Re-engineered details generation with Gemma 4 for: ${name}`);

      console.log(`🧠 [AI Workflow Stage 1] Re-engineered details generation with Gemma 4 for: ${name}`);

      const gemmaPrompt = `
You are an elite luxury perfume market price and catalog generator with deep research skills.
Generate a comprehensive profile for the perfume named "${name}".

LIST OF AVAILABLE BRANDS EXISTING IN OUR DATABASE:
${JSON.stringify(availableBrands || [])}

INSTRUCTIONS:
1. You MUST generate all perfume details, pricing strategies, capacity sizes, discount ratios, and market explanations from scratch. Ignore any previous inputs.
2. Select a factually matching brand strictly from the database brand list above. If none of the brands in the list match the perfume, pick the closest luxury brand or default to the most relevant one from the list.
3. Use the perfume name "${name}" and the chosen brand to research and suggest:
   - A highly professional fragrance description written poetically in standard Vietnamese, strictly divided into three bold headings:
     * **Mô tả hương thơm:** (A beautiful description of olfactory notes, mood, and scent path).
     * **Thông số kỹ thuật & Thuộc tính:** (Details like concentration e.g. EDP/Extrait, group e.g. Woody Spicy, gender, longevity).
     * **Nguồn gốc & Chế độ bảo hành:** (Details like imported country origin e.g. Pháp/Ý, store warranty e.g. 100% authentic guarantee, exchange policy).
   - An optimal standard retail Selling Price (Giá bán) in VNĐ for the standard size (e.g., 2,000,000 to 5,500,000 VNĐ).
   - A list of capacity/size variants and their suggested retail prices in the format "size:price" separated by commas. The AI must dynamically select realistic luxury packaging sizes (e.g. 2ml, 5ml, 10ml for decants/samples, and 30ml, 50ml, 100ml, 150ml, 200ml for standard/large retail sizes) and dynamically calculate appropriate, proportional, rounded retail prices for each.
   - A suitable promotional Discount Percentage (Chiết khấu) (e.g. 5, 10, 15, 20, 25, 30%).
   - A classification tag (e.g., New, Sale, Trending, Limited, Standard).
   - SEO metadata (meta title under 60 chars, meta description under 160 chars in Vietnamese, and 5 keywords).
4. For the three suggested numerical fields (Selling Price, Capacity Variants, and Discount Percentage), you MUST research and cite real-world international references and websites (such as Fragrantica, Basenotes, Sephora, Harrods, Selfridges, or official designer/niche house websites like Chanel, Dior, Creed, Le Labo, Tom Ford etc.) and draft extremely rich, highly specific Vietnamese market analysis reports:
   - Price Decision Report (Báo cáo giải thích giá bán): Cover these exact sections with rich, long-form details:
     * **1. Các tiêu chí cốt lõi để AI gợi ý giá:** (Detailed olfactory raw materials rarity, global scent index e.g. Fragrantica score, successful local transaction records).
     * **2. "Nguồn sản phẩm" đóng vai trò gì trong thuật toán:** (Official distribution vs grey market price differences, safe airfreight logistic costs).
     * **3. Tại sao AI phải đưa ra "Lý do gợi ý giá":** (Liquidity/velocity vs premium exclusivity trade-off, competitive advantages).
     * **4. Quyết định & Khuyến nghị mức Markup (15%):** (Markup margin logic tailored to this brand).
     * **5. Nguồn tham khảo & Đối chiếu của Gemma 4:** (List exact websites, department stores, and catalog indexes consulted for this specific brand/perfume).
   - Capacity Decision Report (Báo cáo giải thích dung tích): Cover 5 detailed sections explaining sizing options, portion pricing logic, decant/sample bottling costs, local customer sizing behaviors in Vietnam, and the specific references consulted.
   - Discount Decision Report (Báo cáo giải thích chiết khấu): Cover 5 detailed sections explaining the suggested discount percentage, competitor promo levels, seasonal factors, retail margins optimization, and the specific references consulted.

LANGUAGE REQUIREMENT:
- You MUST write and describe strictly in pure, standard Vietnamese (tiếng Việt).
- Absolutely NO Chinese characters (Hán tự), mixed Chinese-Vietnamese text, or any other languages are allowed.

Respond with a raw draft containing all these details and reports.
`;

      let gemmaOutput = '';
      try {
        gemmaOutput = await AIService.generateResponse(gemmaPrompt, undefined, 'gemma-4-31b-it');
        console.log(`🧠 [AI Workflow Stage 1] Gemma 4 31B Draft Completed successfully.`);
      } catch (gemmaError: any) {
        console.warn(`⚠️ [AI Fallback] Gemma 4 31B is currently experiencing transient Google API issues (${gemmaError.message}). Falling back to Gemma 4 26B...`);
        try {
          gemmaOutput = await AIService.generateResponse(gemmaPrompt, undefined, 'gemma-4-26b-it');
          console.log(`🧠 [AI Workflow Stage 1 Fallback] Gemma 4 26B Draft Completed successfully.`);
        } catch (gemma26Error: any) {
          console.warn(`⚠️ [AI Fallback 2] Gemma 4 26B also failed (${gemma26Error.message}). Falling back to Gemini 3.1 Flash Lite for Stage 1...`);
          gemmaOutput = await AIService.generateResponse(gemmaPrompt, undefined, 'gemini-3.1-flash-lite');
          console.log(`🧠 [AI Workflow Stage 1 Final Fallback] Gemini 3.1 Draft Completed successfully.`);
        }
      }

      console.log(`✨ [AI Workflow Stage 2] Refining and Auditing with Gemini 3.1 Flash Lite...`);
      const geminiPrompt = `
You are an elite luxury perfume editor and JSON formatter.
You are given the following draft profile of a perfume and market analysis reports generated by another AI (Gemma 4):

--- DRAFT PROFILE & REPORTS FROM GEMMA 4 ---
${gemmaOutput}
---------------------------------------------

YOUR STRICT ASSIGNMENT:
1. Fact-check the draft: Ensure the selected brand strictly belongs to the database brands list: ${JSON.stringify(availableBrands || [])}. Do NOT output any brand name outside this list under any circumstances!
2. Scent Description: Ensure the "description" field is beautifully refined in Vietnamese and contains these three exact bold sections:
   - **Mô tả hương thơm:**
   - **Thông số kỹ thuật & Thuộc tính:**
   - **Nguồn gốc & Chế độ bảo hành:**
3. Pricing & Sizes:
   - Round suggested prices to the nearest 10,000 VNĐ.
   - Read the draft capacity variants and their prices proposed by Gemma 4. You MUST preserve the exact sizes (such as 2ml, 5ml, 10ml, 50ml, 100ml, etc. as analyzed and explained in Gemma 4's draft and sizeReport) and their calculated prices. Format the "size" field strictly as a comma-separated list of "size:price" (e.g., "2ml:90000, 5ml:220000, 10ml:420000, 100ml:2900000"). Do NOT hardcode or default to other sizes.
4. Explanatory Reports:
   - You MUST ensure the reports are extremely detailed, highly informative, rich in market data, and unique to the brand and perfume. They MUST NOT be generic or boilerplate.
   - Format the "priceReport" field as a highly professional markdown text in Vietnamese, covering exactly these 5 headings:
     * **1. Các tiêu chí cốt lõi để AI gợi ý giá:**
     * **2. "Nguồn sản phẩm" đóng vai trò gì trong thuật toán:**
     * **3. Tại sao AI phải đưa ra "Lý do gợi ý giá":**
     * **4. Quyết định & Khuyến nghị mức Markup (15%):**
     * **5. Nguồn tham khảo & Đối chiếu của Gemma 4:** (Must list specific authoritative sites like fragrantica.com, basenotes.com, sephora.com, harrods.com, the brand's official site, etc. that were used to retrieve information for this specific perfume).
   - Format the "sizeReport" field as a detailed markdown text in Vietnamese, explaining sizing options and decant pricing strategy, covering exactly these 5 headings:
     * **1. Cơ cấu dung tích tối ưu cho dòng hương:**
     * **2. Chiến lược định giá phân phối mẫu chiết:**
     * **3. Tại sao AI phải đề xuất dải size đa dạng:**
     * **4. Khuyến nghị cấu trúc phân bổ dung tích:**
     * **5. Nguồn tham khảo & Đối chiếu của Gemma 4:**
   - Format the "discountReport" field as a detailed markdown text in Vietnamese, explaining discount rate selection and margin impact, covering exactly these 5 headings:
     * **1. Mục tiêu chiến dịch chiết khấu của dòng hương:**
     * **2. Tác động của chiết khấu đến biên lợi nhuận:**
     * **3. Tại sao AI đề xuất mức chiết khấu này:**
     * **4. Khuyến nghị lập lịch chiết khấu sự kiện:**
     * **5. Nguồn tham khảo & Đối chiếu của Gemma 4:**
5. Output STRICTLY a valid JSON object conforming to the schema below. Do NOT include markdown code block syntax (like \`\`\`json). Just the raw JSON object.

JSON Schema:
{
  "brand": "Factually correct brand name strictly selected from the database brand list",
  "tag": "one of: 'New', 'Sale', 'Trending', 'Limited', 'Standard'",
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

      const response = await AIService.generateResponse(geminiPrompt, undefined, 'gemini-3.1-flash-lite');
      let jsonString = response.trim();
      
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```json\s*/i, '').replace(/```$/, '');
      }

      const productInfo = JSON.parse(jsonString.trim());
      
      const presetImages = [
        'https://i.ibb.co/C3Y4Vv7Y/perfume2.webp',
        'https://i.ibb.co/p6Zz9zGZ/perfume3.webp',
        'https://i.ibb.co/hR4X5X1X/perfume4.webp',
        'https://i.ibb.co/v6W7V6mF/perfume5.webp'
      ];
      productInfo.image = preFilled.image || presetImages[Math.floor(Math.random() * presetImages.length)];

      console.log(`✨ [AI Workflow Stage 2] Gemini 3.1 Audit & Formatting Completed!`);
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

      console.log(`🧠 [AI Workflow Stage 1] Generating raw details with Gemma 4 for Brand: ${name}`);
      const gemmaPrompt = `
You are a luxury brand archivist.
Write a detailed historical record and identity of the luxury fragrance brand named "${name}".

LANGUAGE REQUIREMENT:
- You MUST write and describe strictly in pure, standard Vietnamese (tiếng Việt).
- Absolutely NO Chinese characters (Hán tự) or mixed-language text are allowed.

Include:
- True country of origin of the brand (e.g., Chanel -> France, Gucci -> Italy, Tom Ford -> US, Jo Malone -> UK).
- Its brand heritage, olfactory philosophy, and motto in Vietnamese.
`;

      let gemmaOutput = '';
      try {
        gemmaOutput = await AIService.generateResponse(gemmaPrompt, undefined, 'gemma-4-31b-it');
        console.log(`🧠 [AI Workflow Stage 1] Gemma 4 31B Brand Draft Completed.`);
      } catch (gemmaError: any) {
        console.warn(`⚠️ [AI Fallback] Gemma 4 31B is currently experiencing transient Google API issues (${gemmaError.message}). Falling back to Gemma 4 26B...`);
        try {
          gemmaOutput = await AIService.generateResponse(gemmaPrompt, undefined, 'gemma-4-26b-it');
          console.log(`🧠 [AI Workflow Stage 1 Fallback] Gemma 4 26B Brand Draft Completed.`);
        } catch (gemma26Error: any) {
          console.warn(`⚠️ [AI Fallback 2] Gemma 4 26B also failed (${gemma26Error.message}). Falling back to Gemini 3.1 Flash Lite for Stage 1...`);
          gemmaOutput = await AIService.generateResponse(gemmaPrompt, undefined, 'gemini-3.1-flash-lite');
          console.log(`🧠 [AI Workflow Stage 1 Final Fallback] Gemini 3.1 Flash Lite Brand Draft Completed.`);
        }
      }

      console.log(`✨ [AI Workflow Stage 2] Refining and Auditing with Gemini 3.1 Flash Lite...`);
      const geminiPrompt = `
You are an elite luxury brand editor and JSON formatter.
You are given the following draft record of a brand generated by another AI (Gemma 4):

--- DRAFT RECORD FROM GEMMA 4 ---
${gemmaOutput}
---------------------------------

Your tasks:
1. Fact-check the draft: Ensure the country of origin is 100% accurate (e.g., Chanel -> "Pháp", Gucci -> "Ý", Jo Malone -> "Vương quốc Anh"). Correct it if wrong.
2. Refine the Vietnamese brand motto/story: Make it incredibly elegant, high-end, smooth, and professional in Vietnamese. 2-3 sentences.
3. Language Control: Output strictly in 100% pure, standard Vietnamese. Absolutely NO Chinese characters (Hán tự), Sino-Chinese terms, or mixed languages.
4. Output STRICTLY a valid JSON object conforming to the schema below.
5. Do NOT include markdown code block syntax (like \`\`\`json). Just the raw JSON object.

JSON Schema:
{
  "origin": "Factually correct country of origin in Vietnamese",
  "description": "Exquisite, poetic brand story in Vietnamese. 2-3 sentences."
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

      console.log(`✨ [AI Workflow Stage 2] Gemini 3.1 Brand Audit & Formatting Completed!`);
      return reply.status(200).send({ success: true, data: brandInfo });
    } catch (error: any) {
      console.error('AI Brand Generation Error:', error);
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

      console.log(`🧠 [AI Price Suggestion Stage 1] Context-Aware price drafting with Gemma 4 for: ${name}`);

      const gemmaPrompt = `
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

      let gemmaOutput = '';
      try {
        gemmaOutput = await AIService.generateResponse(gemmaPrompt, undefined, 'gemma-4-31b-it');
        console.log(`🧠 [AI Price Suggestion Stage 1] Gemma 4 31B Draft Completed successfully.`);
      } catch (gemmaError: any) {
        console.warn(`⚠️ [AI Fallback] Gemma 4 31B is currently experiencing transient Google API issues (${gemmaError.message}). Falling back to Gemma 4 26B...`);
        try {
          gemmaOutput = await AIService.generateResponse(gemmaPrompt, undefined, 'gemma-4-26b-it');
          console.log(`🧠 [AI Price Suggestion Stage 1 Fallback] Gemma 4 26B Draft Completed successfully.`);
        } catch (gemma26Error: any) {
          console.warn(`⚠️ [AI Fallback 2] Gemma 4 26B also failed (${gemma26Error.message}). Falling back to Gemini 3.1 Flash Lite...`);
          gemmaOutput = await AIService.generateResponse(gemmaPrompt, undefined, 'gemini-3.1-flash-lite');
          console.log(`🧠 [AI Price Suggestion Stage 1 Final Fallback] Gemini 3.1 Draft Completed successfully.`);
        }
      }

      console.log(`✨ [AI Price Suggestion Stage 2] Math Auditing & Refining with Gemini 3.1 Flash Lite...`);
      const geminiPrompt = `
You are an elite luxury perfume price analyst and JSON formatter.
You are given a draft market price report generated by another AI (Gemma 4):

--- DRAFT MARKET REPORT FROM GEMMA 4 ---
${gemmaOutput}
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
