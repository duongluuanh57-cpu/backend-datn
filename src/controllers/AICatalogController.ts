import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../services/AIService.ts';
import { TaxonomyTerm } from '../models/TaxonomyTerm.ts';
import { Taxonomy } from '../models/Taxonomy.ts';
import { Tag } from '../models/Tag.ts';
import { Brand } from '../models/Brand.ts';
import { redis } from '../config/redis.ts';

export class AICatalogController {
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
        availableSizes,
        availableTags
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
        availableTags?: string[];
      };

      if (!name) return reply.status(400).send({ error: 'Name is required' });

      const tenantId = (req as any).user?.tenantId || 'default-tenant';

      // Build pre-filled context
      const preFilled: Record<string, any> = {};
      if (brand?.trim()) preFilled.brand = brand.trim();
      if (price && price > 0) preFilled.price = price;
      if (size?.trim()) preFilled.size = size.trim();
      if (description?.trim()) preFilled.description = description.trim();
      if (tag?.trim()) preFilled.tag = tag.trim();
      if (quantityInStock && quantityInStock > 0) preFilled.quantityInStock = quantityInStock;
      if (discountPercentage && discountPercentage > 0) preFilled.discountPercentage = discountPercentage;
      if (metaTitle?.trim()) preFilled.metaTitle = metaTitle.trim();
      if (metaDescription?.trim()) preFilled.metaDescription = metaDescription.trim();
      if (keywords?.trim()) preFilled.keywords = keywords.trim();
      if (image?.trim()) preFilled.image = image.trim();

      const sizesJson = JSON.stringify(
        availableSizes || ['2ml', '5ml', '10ml', '30ml', '50ml', '75ml', '100ml', '125ml', '150ml']
      );

      // ── OPTIMIZATION 1: Pre-fetch tất cả taxonomy, tag & brand song song ──────────
      // Thay vì query DB nhiều lần sau khi AI trả về → fetch 1 lần ngay từ đầu
      console.log(`🚀 [AI generateProduct] Pre-fetching taxonomies, tags & brands in parallel for: ${name}`);
      const [allTaxonomies, allTags, allBrands] = await Promise.all([
        // Lấy tất cả TaxonomyTerm mới, kèm taxonomyId để group theo slug
        TaxonomyTerm.find({ tenantId, status: 'active' }).populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug' }).lean(),
        Tag.find({ tenantId, status: 'active' }).lean(),
        Brand.find({ tenantId, status: 'active' }).lean()
      ]);

      // Group terms by taxonomy slug để O(1) lookup
      const taxonomyByType: Record<string, any[]> = {};
      for (const t of allTaxonomies) {
        const slug = (t.taxonomyId as any)?.slug;
        if (!slug) continue;
        if (!taxonomyByType[slug]) taxonomyByType[slug] = [];
        taxonomyByType[slug].push(t);
      }

      // Helper: in-memory fuzzy match (không cần query DB thêm)
      const normStr = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      const findTaxonomy = (inputName: string, type: string) => {
        const list = taxonomyByType[type] || [];
        if (list.length === 0) return null;
        const norm = normStr(inputName);
        return (
          list.find(t => normStr(t.name) === norm) ||
          list.find(t => normStr(t.name).includes(norm) || norm.includes(normStr(t.name))) ||
          list[0]
        );
      };

      // ── OPTIMIZATION 2: Single-stage prompt (gộp Draft + Refine thành 1 call) ─
      console.log(`🧠 [AI generateProduct] Single-stage generation with Gemini 3.1 Flash Lite for: ${name}`);

      const singleStagePrompt = `
You are an elite luxury perfume catalog AI. Generate a complete, production-ready JSON profile for the perfume named "${name}".

AVAILABLE DATABASE VALUES (MUST use ONLY these — no exceptions):
- Brands: ${JSON.stringify(availableBrands || [])}
- Sizes: ${sizesJson}
- Scent Groups: ${JSON.stringify(availableScentGroups || [])}
- Concentrations: ${JSON.stringify(availableConcentrations || [])}
- Segments: ${JSON.stringify(availableSegments || [])}
- Genders: ${JSON.stringify(availableGenders || [])}
- Tags (chọn 1 tag phụ, KHÔNG chọn "Standard" — tag Standard sẽ được tự động thêm): ${JSON.stringify((availableTags || ['New', 'Sale', 'Trending', 'Limited']).filter((t: string) => t.toLowerCase() !== 'standard'))}

RULES:
1. Brand: Must match EXACTLY one entry from the Brands list. If uncertain, pick the closest match.
2. Tag: Must be EXACTLY one from the Tags list above (do NOT pick "Standard" — it will be added automatically). Pick the most relevant tag for this product.
3. scentGroup / concentration / segment / gender: Must be EXACTLY one from each respective list.
4. Sizes: Use ONLY sizes from the Sizes list. Format: "size:price" pairs separated by commas (e.g., "2ml:90000, 10ml:420000, 100ml:2900000"). Calculate prices proportionally.
5. Price: Standard retail price in VNĐ, rounded to nearest 10,000.
6. Description: Write in Vietnamese with EXACTLY these three bold headings:
   - **Mô tả hương thơm:**
   - **Thông số kỹ thuật & Thuộc tính:**
   - **Nguồn gốc & Chế độ bảo hành:**
7. Language: All text fields in Vietnamese. No Chinese characters allowed.
8. priceReport (300-500 từ, tiếng Việt): Must include 4 sections:
   - **1. Các tiêu chí cốt lõi để AI gợi ý giá:** (phân tích thương hiệu, độ hiếm, nồng độ, nguyên liệu)
   - **2. "Nguồn sản phẩm" đóng vai trò gì:** (hàng chính hãng vs parallel import vs tester)
   - **3. So sánh giá với sản phẩm tương tự:** (2-3 sản phẩm cùng phân khúc)
   - **4. Dự đoán xu hướng giá 6-12 tháng tới:**
9. sizeReport (300-500 từ, tiếng Việt): Must include 4 sections:
   - **1. Tại sao có nhiều dung tích khác nhau:**
   - **2. Phân tích giá trị từng dung tích:**
   - **3. Xu hướng tiêu dùng theo dung tích tại Việt Nam:**
   - **4. Khuyến nghị cho từng đối tượng:**
10. discountReport (300-500 từ, tiếng Việt): Must include 4 sections:
    - **1. Cơ sở đưa ra mức chiết khấu:**
    - **2. So sánh với các đợt sale trước:**
    - **3. Đánh giá mức độ hấp dẫn:**
    - **4. Thời điểm tốt nhất để mua:**

Output ONLY a raw valid JSON object. No markdown, no code blocks.

{
  "brand": "string from brand list",
  "tag": "string from tag list",
  "scentGroup": "string from scent group list",
  "concentration": "string from concentration list",
  "segment": "string from segment list",
  "gender": "string from gender list",
  "description": "Vietnamese description with 3 bold sections",
  "price": number,
  "size": "size:price, size:price, ...",
  "discountPercentage": number,
  "priceReport": "Vietnamese report ~400 words with 4 bold sections",
  "sizeReport": "Vietnamese report ~400 words with 4 bold sections",
  "discountReport": "Vietnamese report ~400 words with 4 bold sections",
  "metaTitle": "SEO title under 60 chars in Vietnamese",
  "metaDescription": "SEO desc under 160 chars in Vietnamese",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}
`;

      let jsonString = '';
      try {
        const raw = await AIService.generateResponse(singleStagePrompt, undefined, 'gemini-3.1-flash-lite');
        jsonString = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
      } catch (err: any) {
        console.warn(`⚠️ [AI Retry] ${err.message}`);
        const raw = await AIService.generateResponse(singleStagePrompt, undefined, 'gemini-3.1-flash-lite');
        jsonString = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
      }

      // Validate and fix JSON before parsing
      let productInfo: any;
      try {
        // Log raw JSON for debugging
        console.log(`📝 [AI Raw JSON] Length: ${jsonString.length} chars`);
        console.log(`📝 [AI Raw JSON Preview]: ${jsonString.substring(0, 500)}...`);

        // Try to parse directly first
        productInfo = JSON.parse(jsonString);
      } catch (parseError: any) {
        console.error(`❌ [AI JSON Parse Error] ${parseError.message}`);
        console.error(`❌ [AI Raw JSON] ${jsonString.substring(0, 1000)}`);

        // Attempt to fix common JSON errors
        try {
          // Remove trailing commas
          let fixedJson = jsonString.replace(/,(\s*[}\]])/g, '$1');
          // Fix quotes in keys/values
          fixedJson = fixedJson.replace(/(\w+):/g, '"$1":');
          fixedJson = fixedJson.replace(/:\s*([^",{\[\d][^",{\[\]]*)/g, (match) => {
            const val = match.trim().substring(1);
            if (val.includes('"')) return match;
            return `: "${val}"`;
          });

          console.log(`🔧 [AI JSON Fix Attempt] Applying fixes...`);
          productInfo = JSON.parse(fixedJson);
          console.log(`✅ [AI JSON Fix] Successfully parsed after fixes`);
        } catch (fixError: any) {
          console.error(`❌ [AI JSON Fix Failed] ${fixError.message}`);
          return reply.status(500).send({
            error: 'AI trả về JSON không hợp lệ',
            details: parseError.message,
            rawResponse: jsonString.substring(0, 500)
          });
        }
      }

      // ── OPTIMIZATION 3: Resolve taxonomy & tag song song (in-memory, 0 DB queries) ─
      const [scentGroupResult, concentrationResult, segmentResult] = await Promise.all([
        // scentGroup
        Promise.resolve((() => {
          if (!productInfo.scentGroup) return null;
          const names = String(productInfo.scentGroup).split(',').map((s: string) => s.trim()).filter(Boolean);
          return names.map((n: string) => findTaxonomy(n, 'scent_group')).filter(Boolean);
        })()),
        // concentration
        Promise.resolve((() => {
          if (!productInfo.concentration) return null;
          const names = String(productInfo.concentration).split(',').map((s: string) => s.trim()).filter(Boolean);
          return names.map((n: string) => findTaxonomy(n, 'concentration')).filter(Boolean);
        })()),
        // segment
        Promise.resolve((() => {
          if (!productInfo.segment) return null;
          const names = String(productInfo.segment).split(',').map((s: string) => s.trim()).filter(Boolean);
          return names.map((n: string) => findTaxonomy(n, 'segment')).filter(Boolean);
        })())
      ]);

      if (scentGroupResult?.length) {
        productInfo.scentGroups = scentGroupResult.map((t: any) => t._id);
        productInfo.scentGroup = scentGroupResult.map((t: any) => t.name).join(', ');
        console.log(`✅ scentGroup resolved: ${productInfo.scentGroup}`);
      }
      if (concentrationResult?.length) {
        productInfo.concentrations = concentrationResult.map((t: any) => t._id);
        productInfo.concentration = concentrationResult.map((t: any) => t.name).join(', ');
        console.log(`✅ concentration resolved: ${productInfo.concentration}`);
      }
      if (segmentResult?.length) {
        productInfo.segments = segmentResult.map((t: any) => t._id);
        productInfo.segment = segmentResult.map((t: any) => t.name).join(', ');
        console.log(`✅ segment resolved: ${productInfo.segment}`);
      }

      // Tag matching (in-memory)
      // Logic: luôn có "Standard" tag + 1 tag AI chọn (tối đa 2 tag)
      const standardTag = allTags.find(t => normStr(t.name) === 'standard');
      const resolvedTagIds: any[] = [];
      const resolvedTagNames: string[] = [];

      // 1. Luôn thêm Standard tag trước
      if (standardTag) {
        resolvedTagIds.push(standardTag._id);
        resolvedTagNames.push(standardTag.name);
        console.log(`✅ Standard tag auto-added: ${standardTag.name}`);
      }

      // 2. AI chọn thêm 1 tag phụ (không phải Standard)
      if (productInfo.tag && allTags.length > 0) {
        const norm = normStr(String(productInfo.tag));
        // Bỏ qua nếu AI chọn Standard (đã có rồi)
        if (norm !== 'standard') {
          const matched =
            allTags.find(t => normStr(t.name) === norm && normStr(t.name) !== 'standard') ||
            allTags.find(t => (normStr(t.name).includes(norm) || norm.includes(normStr(t.name))) && normStr(t.name) !== 'standard');
          if (matched) {
            resolvedTagIds.push(matched._id);
            resolvedTagNames.push(matched.name);
            console.log(`✅ AI tag resolved: ${matched.name}`);
          }
        }
      }

      if (resolvedTagIds.length > 0) {
        productInfo.tags = resolvedTagIds;
        productInfo.tag = resolvedTagNames.join(',');
      } else {
        delete productInfo.tag;
      }

      // Brand matching (in-memory)
      if (productInfo.brand && allBrands.length > 0) {
        const norm = normStr(String(productInfo.brand));
        const matchedBrand =
          allBrands.find(b => normStr(b.name) === norm) ||
          allBrands.find(b => normStr(b.name).includes(norm) || norm.includes(normStr(b.name)));
        if (matchedBrand) {
          productInfo.brandId = matchedBrand._id;
          productInfo.brand = matchedBrand.name; // Đảm bảo trả về đúng tên từ DB
          console.log(`✅ Brand resolved: ${matchedBrand.name} (ID: ${matchedBrand._id})`);
        } else {
          console.warn(`⚠️ Brand "${productInfo.brand}" not found in database, keeping as-is`);
        }
      }

      const presetImages = [
        'https://i.ibb.co/LhJhpsKs/Midnight-Rose-copy.webp',
        'https://i.ibb.co/6cQSVbRX/Simple-Product-Golden-Amber.webp',
        'https://i.ibb.co/gH9dMN4/26689197.webp',
        'https://i.ibb.co/4wB9f8mn/Royal-Blue-Musk-scaled.webp'
      ];
      productInfo.image = preFilled.image || presetImages[Math.floor(Math.random() * presetImages.length)];

      console.log(`✅ [AI generateProduct] Done in single stage for: ${name}`);
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

      if (jsonString.startsWith('\`\`\`')) {
        jsonString = jsonString.replace(/^\`\`\`json\s*/i, '').replace(/\`\`\`$/, '');
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
      const suggestions = response.split('\\n')
        .map(s => s.replace(/^[-\\d.\\s"'`*•\\[\\]]+/, '').replace(/["'\`*\\]\\[]+$/, '').trim())
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
}
