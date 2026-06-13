import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../../services/AIService.ts';
import { TaxonomyTerm } from '../../models/TaxonomyTerm.ts';
import { Taxonomy } from '../../models/Taxonomy.ts';
import { Tag } from '../../models/Tag.ts';
import { Brand } from '../../models/Brand.ts';
import { Category } from '../../models/Category.ts';
import { FuzzyMatchCache } from '../../services/FuzzyMatchCache.ts';
import { sanitizeJsonString, extractAndFixJson } from './sanitizeJson.ts';

/**
 * Generate product info using AI (single-stage Gemini)
 */
export async function generateProduct(req: FastifyRequest, reply: FastifyReply) {
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
      longevity,
      sillage,
      durability,
      scentTrail,
      style,
      suitableFor,
      occasion,
      availableBrands,
      availableScentGroups,
      availableConcentrations,
      availableSegments,
      availableGenders,
      availableCategories,
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
      longevity?: string;
      sillage?: string;
      durability?: string;
      scentTrail?: string;
      style?: string;
      suitableFor?: string;
      occasion?: string;
      availableBrands?: string[];
      availableScentGroups?: string[];
      availableConcentrations?: string[];
      availableSegments?: string[];
      availableGenders?: string[];
      availableCategories?: string[];
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
    // KHÔNG gửi tag làm pre-filled để AI tự chọn theo rule (tránh giữ Sale cũ khi discount không đủ)
    if (quantityInStock && quantityInStock > 0) preFilled.quantityInStock = quantityInStock;
    // KHÔNG gửi discountPercentage làm pre-filled để AI tự chọn (tránh giữ 10% cũ)
    if (metaTitle?.trim()) preFilled.metaTitle = metaTitle.trim();
    if (metaDescription?.trim()) preFilled.metaDescription = metaDescription.trim();
    if (keywords?.trim()) preFilled.keywords = keywords.trim();
    if (image?.trim()) preFilled.image = image.trim();
    if (longevity?.trim()) preFilled.longevity = longevity.trim();
    if (sillage?.trim()) preFilled.sillage = sillage.trim();
    if (durability?.trim()) preFilled.durability = durability.trim();
    if (scentTrail?.trim()) preFilled.scentTrail = scentTrail.trim();
    if (style?.trim()) preFilled.style = style.trim();
    if (suitableFor?.trim()) preFilled.suitableFor = suitableFor.trim();
    if (occasion?.trim()) preFilled.occasion = occasion.trim();

    const sizesJson = JSON.stringify(
      availableSizes || ['2ml', '5ml', '10ml', '30ml', '50ml', '75ml', '100ml', '125ml', '150ml']
    );

    // ── OPTIMIZATION 1: Cache-backed taxonomy, tag & brand lookup ──────────
    console.log(`🚀 [AI generateProduct] Loading taxonomies, tags & brands (cached) for: ${name}`);

    const [allTaxonomies, allTags, allBrands, allCategories] = await Promise.all([
      FuzzyMatchCache.getOrFetch('terms:all:active', () =>
        TaxonomyTerm.find({ tenantId, status: 'active' }).populate({ path: 'taxonomyId', model: 'Taxonomy', select: 'slug' }).lean()
      ),
      FuzzyMatchCache.getOrFetch(`tags:${tenantId}:active`, () =>
        Tag.find({ tenantId, status: 'active' }).lean()
      ),
      FuzzyMatchCache.getOrFetch(`brands:${tenantId}:active`, () =>
        Brand.find({ tenantId, status: 'active' }).lean()
      ),
      FuzzyMatchCache.getOrFetch(`categories:${tenantId}:active`, () =>
        Category.find({ tenantId, status: 'active' }).lean()
      ),
    ]);

    // Group terms by taxonomy slug
    const taxonomyByType: Record<string, any[]> = {};
    for (const t of allTaxonomies.items) {
      const slug = (t.taxonomyId as any)?.slug;
      if (!slug) continue;
      if (!taxonomyByType[slug]) taxonomyByType[slug] = [];
      taxonomyByType[slug].push(t);
    }

    const findTaxonomy = (inputName: string, type: string) => {
      const list = taxonomyByType[type] || [];
      if (list.length === 0) return null;
      const termLookup = new Map<string, any>();
      for (const t of list) termLookup.set(FuzzyMatchCache.normalize(t.name), t);
      return FuzzyMatchCache.fuzzyFind(inputName, termLookup, (t: any) => t.name) || list[0];
    };

    // ── OPTIMIZATION 2: Single-stage prompt ─
    console.log(`🧠 [AI generateProduct] Single-stage generation with Gemini 3.1 Flash Lite for: ${name}`);

    // Lọc availableTags — chỉ gửi tag đang tồn tại trong DB (tránh AI chọn tag đã xóa)
    const activeTagNamesFromDb = new Set(Array.from(allTags.lookup.values()).map((t: any) => t.name));
    const filteredTags = (availableTags || []).filter((t: string) => activeTagNamesFromDb.has(t));
    // Fallback nếu filter hết: dùng tất cả tag từ DB (trừ standard)
    const finalTagsForPrompt = filteredTags.length > 0 ? filteredTags : Array.from(allTags.lookup.values()).filter((t: any) => t.name.toLowerCase() !== 'standard').map((t: any) => t.name);

    const singleStagePrompt = `
You are an elite luxury perfume catalog AI. Generate a complete, production-ready JSON profile for the perfume named "${name}".

AVAILABLE DATABASE VALUES (MUST use ONLY these — no exceptions):
- Brands: ${JSON.stringify(availableBrands || [])}
- Sizes: ${sizesJson}
- Scent Groups: ${JSON.stringify(availableScentGroups || [])}
- Concentrations: ${JSON.stringify(availableConcentrations || [])}
- Segments: ${JSON.stringify(availableSegments || [])}
- Categories: ${JSON.stringify(availableCategories || availableGenders || [])}
- Tags (CHỈ được chọn từ danh sách này, KHÔNG tự ý thêm tag khác — chọn 1 tag phụ, KHÔNG chọn "Standard" — tag Standard sẽ được tự động thêm): ${JSON.stringify(finalTagsForPrompt.filter((t: string) => t.toLowerCase() !== 'standard'))}

RULES:
1. Brand: Must match EXACTLY one entry from the Brands list. If uncertain, pick the closest match.
2. Tag: Must be EXACTLY one from the Tags list above (do NOT pick "Standard"). Pick the most relevant tag. IMPORTANT — Tag "Sale" chỉ được chọn khi discountPercentage > 10 VÀ discountEndDate khác null. Nếu không đáp ứng, KHÔNG chọn "Sale".
3. scentGroup / concentration / segment / category: MUST select AT LEAST 2 values from each respective list. FAIL if you provide fewer than 2. Use comma-separated format.
4. Sizes: Use ONLY sizes from the Sizes list. Format: "size:price" pairs separated by commas. QUAN TRỌNG — danh sách size PHẢI luôn bao gồm dung tích 50ml. Các dung tích khác (2ml, 5ml, 10ml, 30ml, 75ml, 100ml, ...) có thể có hoặc không, nhưng 50ml là BẮT BUỘC.
5. Price: KHÔNG điền price — Price sẽ được lấy từ giá của dung tích 50ml bên size field. Price = 0.
  6. Description: Write in Vietnamese with EXACTLY three bold headings. Separate each bold section with a blank line (use \n\n between sections).
7. Language: All text fields in Vietnamese. No Chinese characters allowed.
8. priceReport (300-500 từ, tiếng Việt): Must include 4 sections.
9. sizeReport (300-500 từ, tiếng Việt): Must include 4 sections.
10. discountReport (300-500 từ, tiếng Việt): Must include 4 sections.
11. Pre-filled fields (already provided by user) MUST be kept as-is — do NOT regenerate or modify them.

PRE-FILLED FIELDS (keep these values unchanged): ${JSON.stringify(Object.keys(preFilled).length > 0 ? preFilled : '(none)')}

Output ONLY a raw valid JSON object. No markdown, no code blocks.

{
  "brand": "string from brand list",
  "tag": "string from tag list",
  "scentGroup": "scent group 1, scent group 2",
  "concentration": "concentration 1, concentration 2",
  "segment": "segment 1, segment 2",
  "category": "category 1, category 2",
  "description": "Vietnamese description with 3 bold sections",
  "size": "size:price, size:price, ... (PHẢI có 50ml)",
  "discountPercentage": number,
  "discountStartDate": "ISO date string or null (ví dụ 2026-07-15T00:00:00.000Z, null nếu không có giảm giá)",
  "discountEndDate": "ISO date string or null (ví dụ 2026-08-15T00:00:00.000Z, null nếu không có giảm giá)",
  "priceReport": "Vietnamese report ~400 words with 4 bold sections",
  "sizeReport": "Vietnamese report ~400 words with 4 bold sections",
  "discountReport": "Vietnamese report ~400 words with 4 bold sections",
  "longevity": "Thời gian lưu hương (VD: 7 - 9 giờ)",
  "sillage": "Độ tỏa hương (VD: 1m)",
  "durability": "Độ bền mùi (VD: Ổn định từ sáng tới chiều, không bị bay mùi nhanh)",
  "scentTrail": "Vệt hương (VD: Mịn, rõ nét, luôn tạo cảm giác sạch sẽ)",
  "season": "Mùa phù hợp, dùng , để phân cách",
  "time": "Thời gian phù hợp, dùng , để phân cách",
  "style": "Phong cách (VD: Lịch lãm, hiện đại)",
  "suitableFor": "Đối tượng phù hợp, dùng | để phân cách (VD: văn phòng | hẹn hò | tiệc tối)",
  "occasion": "Dịp sử dụng, dùng | để phân cách (VD: ban ngày | đi làm | dự tiệc)",
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
      console.log(`📝 [AI Raw JSON] Length: ${jsonString.length} chars`);
      productInfo = extractAndFixJson(jsonString);
      console.log(`✅ [AI JSON] Successfully parsed`);
    } catch (parseError: any) {
      console.error(`❌ [AI JSON Parse Failed] ${parseError.message}`);
      return reply.status(500).send({
        error: 'AI trả về JSON không hợp lệ',
        details: parseError.message,
        rawResponse: jsonString.substring(0, 500)
      });
    }

    // Parse giá từ dung tích 50ml trong size field — tự động, không hardcode
    let priceFromSize = 0;
    const sizeStr = String(productInfo.size || '');
    sizeStr.split(',').forEach((s: string) => {
      const parts = s.trim().split(':');
      if (parts.length < 2) return;
      const label = parts[0].toLowerCase().replace(/\s/g, '');
      const val = Number(parts[1]) || 0;
      if (!priceFromSize) {
        // Lấy giá của size đầu tiên (thường là nhỏ nhất) làm fallback
        priceFromSize = val;
      }
      // Ưu tiên 50ml — match "50ml" hoặc số "50"
      if (label === '50ml' || label === '50' || /^50/.test(label)) {
        priceFromSize = val;
      }
    });
    console.log(`[AI Price] size="${sizeStr}" → priceFromSize=${priceFromSize}`);
    delete productInfo.price;
    productInfo.price = priceFromSize;

    // ── OPTIMIZATION 3: Resolve taxonomy & tag in-memory ─

    // Helper: ensure at least 2 items from AI hint + DB pool
    const ensureMinTwo = (hint: string, pool: any[], typeSlug: string): { names: string[]; ids: string[] } => {
      const names: string[] = [];
      const ids: string[] = [];
      console.log(`🔍 [ensureMinTwo:${typeSlug}] hint="${String(hint || '')}", pool size=${pool.length}`);
      if (pool.length < 2) {
        console.warn(`⚠️ [ensureMinTwo:${typeSlug}] Pool has only ${pool.length} items`);
      }
      if (hint) {
        const input = String(hint).split(',').map((s) => s.trim()).filter(Boolean);
        for (const name of input) {
          const found = findTaxonomy(name, typeSlug);
          const matchInfo = found ? `matched="${found.name}"` : 'NO MATCH (fallback)';
          console.log(`  → [${typeSlug}] hint="${name}" ${matchInfo}`);
          if (found && !names.includes(found.name)) { names.push(found.name); ids.push(found._id); }
        }
      }
      for (const item of pool) {
        if (names.length >= 2) break;
        if (!names.includes(item.name)) {
          console.log(`  → [${typeSlug}] pool fallback adding="${item.name}"`);
          names.push(item.name); ids.push(item._id);
        }
      }
      console.log(`✅ [ensureMinTwo:${typeSlug}] result: ${names.join(', ')} (${names.length} items)`);
      return { names, ids };
    };

    // Scent groups
    {
      const sg = ensureMinTwo(productInfo.scentGroup, taxonomyByType['scent_group'] || [], 'scent_group');
      productInfo.scentGroups = sg.ids;
      productInfo.scentGroup = sg.names.join(', ');
      console.log(`✅ scentGroup resolved: ${productInfo.scentGroup}`);
    }
    // Concentrations
    {
      const co = ensureMinTwo(productInfo.concentration, taxonomyByType['concentration'] || [], 'concentration');
      productInfo.concentrations = co.ids;
      productInfo.concentration = co.names.join(', ');
      console.log(`✅ concentration resolved: ${productInfo.concentration}`);
    }
    // Segments
    {
      const se = ensureMinTwo(productInfo.segment, taxonomyByType['segment'] || [], 'segment');
      productInfo.segments = se.ids;
      productInfo.segment = se.names.join(', ');
      console.log(`✅ segment resolved: ${productInfo.segment}`);
    }

    // ── Sale tag enforcement: chỉ chọn Sale khi > 10% + có discountEndDate ──
    const hasValidSale = (productInfo.discountPercentage > 10 && productInfo.discountEndDate);
    const saleTagEntry = allTags.lookup.get('sale');

    // Tag matching — Standard + at least 1 more
    const standardTag = allTags.lookup.get('standard');
    const resolvedTagIds: any[] = [];
    const resolvedTagNames: string[] = [];

    if (standardTag) {
      resolvedTagIds.push(standardTag._id);
      resolvedTagNames.push(standardTag.name);
      console.log(`✅ Standard tag auto-added: ${standardTag.name}`);
    }

    if (productInfo.tag) {
      const matched = FuzzyMatchCache.fuzzyFind(productInfo.tag, allTags.lookup, (t: any) => t.name);
      if (matched && FuzzyMatchCache.normalize(matched.name) !== 'standard') {
        const isSale = FuzzyMatchCache.normalize(matched.name) === 'sale';
        if (isSale && !hasValidSale) {
          console.log(`⚠️ AI picked "Sale" but discount (${productInfo.discountPercentage}%, endDate=${productInfo.discountEndDate}) does NOT qualify — skipping Sale tag`);
        } else {
          resolvedTagIds.push(matched._id);
          resolvedTagNames.push(matched.name);
          console.log(`✅ AI tag resolved: ${matched.name}`);
        }
      }
    }

    // If discount qualifies for Sale but no Sale tag picked, auto-add
    if (hasValidSale && saleTagEntry && !resolvedTagNames.some(n => FuzzyMatchCache.normalize(n) === 'sale')) {
      resolvedTagIds.push(saleTagEntry._id);
      resolvedTagNames.push(saleTagEntry.name);
      console.log(`✅ Sale tag auto-added (discount ${productInfo.discountPercentage}% with endDate)`);
    }

    // Ensure at least 2 tags (Standard + 1 random)
    if (resolvedTagIds.length < 2) {
      for (const [norm, tag] of allTags.lookup) {
        if (norm === 'standard') continue;
        resolvedTagIds.push(tag._id);
        resolvedTagNames.push(tag.name);
        console.log(`✅ Extra tag auto-added: ${tag.name}`);
        break;
      }
    }

    if (resolvedTagIds.length > 0) {
      productInfo.tags = resolvedTagIds;
      productInfo.tag = resolvedTagNames.join(',');
    } else {
      delete productInfo.tag;
    }

    // Brand matching
    if (productInfo.brand) {
      const matchedBrand = FuzzyMatchCache.fuzzyFind(productInfo.brand, allBrands.lookup, (b: any) => b.name);
      if (matchedBrand) {
        productInfo.brandId = matchedBrand._id;
        productInfo.brand = matchedBrand.name;
        console.log(`✅ Brand resolved: ${matchedBrand.name} (ID: ${matchedBrand._id})`);
      } else {
        console.warn(`⚠️ Brand "${productInfo.brand}" not found in database, keeping as-is`);
      }
    }

    // Category matching — ensure at least 2
    {
      const catNames: string[] = [];
      const catIds: string[] = [];
      if (productInfo.category) {
        const names = String(productInfo.category).split(',').map((s: string) => s.trim()).filter(Boolean);
        const matched = names.map(n => FuzzyMatchCache.fuzzyFind(n, allCategories.lookup, (c: any) => c.name)).filter(Boolean);
        for (const c of matched) {
          if (!catNames.includes(c.name)) { catNames.push(c.name); catIds.push(c._id); }
        }
      }
      for (const c of (allCategories.items || [])) {
        if (catNames.length >= 2) break;
        if (!catNames.includes(c.name)) { catNames.push(c.name); catIds.push(c._id); }
      }
      productInfo.categories = catIds;
      productInfo.category = catNames.join(', ');
      if (catNames.length > 0) {
        console.log(`✅ category resolved: ${productInfo.category}`);
      } else {
        console.warn(`⚠️ No categories found in database`);
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