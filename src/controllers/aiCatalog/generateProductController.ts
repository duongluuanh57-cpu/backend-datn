import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../../services/AIService.ts';
import { TaxonomyTerm } from '../../models/TaxonomyTerm.ts';
import { Taxonomy } from '../../models/Taxonomy.ts';
import { Tag } from '../../models/Tag.ts';
import { Brand } from '../../models/Brand.ts';
import { Category } from '../../models/Category.ts';
import { FuzzyMatchCache } from '../../services/FuzzyMatchCache.ts';
import { sanitizeJsonString } from './sanitizeJson.ts';

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

    const singleStagePrompt = `
You are an elite luxury perfume catalog AI. Generate a complete, production-ready JSON profile for the perfume named "${name}".

AVAILABLE DATABASE VALUES (MUST use ONLY these — no exceptions):
- Brands: ${JSON.stringify(availableBrands || [])}
- Sizes: ${sizesJson}
- Scent Groups: ${JSON.stringify(availableScentGroups || [])}
- Concentrations: ${JSON.stringify(availableConcentrations || [])}
- Segments: ${JSON.stringify(availableSegments || [])}
- Categories: ${JSON.stringify(availableCategories || availableGenders || [])}
- Tags (chọn 1 tag phụ, KHÔNG chọn "Standard" — tag Standard sẽ được tự động thêm): ${JSON.stringify((availableTags || ['New', 'Sale', 'Trending', 'Limited']).filter((t: string) => t.toLowerCase() !== 'standard'))}

RULES:
1. Brand: Must match EXACTLY one entry from the Brands list. If uncertain, pick the closest match.
2. Tag: Must be EXACTLY one from the Tags list above (do NOT pick "Standard"). Pick the most relevant tag.
3. scentGroup / concentration / segment / category: May select MULTIPLE values (2 or more) from each respective list.
4. Sizes: Use ONLY sizes from the Sizes list. Format: "size:price" pairs separated by commas.
5. Price: Standard retail price in VNĐ, rounded to nearest 10,000.
6. Description: Write in Vietnamese with EXACTLY three bold headings.
7. Language: All text fields in Vietnamese. No Chinese characters allowed.
8. priceReport (300-500 từ, tiếng Việt): Must include 4 sections.
9. sizeReport (300-500 từ, tiếng Việt): Must include 4 sections.
10. discountReport (300-500 từ, tiếng Việt): Must include 4 sections.

Output ONLY a raw valid JSON object. No markdown, no code blocks.

{
  "brand": "string from brand list",
  "tag": "string from tag list",
  "scentGroup": "string from scent group list",
  "concentration": "string from concentration list",
  "segment": "string from segment list",
  "category": "string from category list",
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
      console.log(`📝 [AI Raw JSON] Length: ${jsonString.length} chars`);
      productInfo = JSON.parse(jsonString);
    } catch (parseError: any) {
      console.error(`❌ [AI JSON Parse Error] ${parseError.message}`);
      try {
        let fixedJson = jsonString.replace(/,(\s*[}\]])/g, '$1');
        fixedJson = sanitizeJsonString(fixedJson);
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

    // ── OPTIMIZATION 3: Resolve taxonomy & tag in-memory ─
    const [scentGroupResult, concentrationResult, segmentResult] = await Promise.all([
      Promise.resolve((() => {
        if (!productInfo.scentGroup) return null;
        const names = String(productInfo.scentGroup).split(',').map((s: string) => s.trim()).filter(Boolean);
        return names.map((n: string) => findTaxonomy(n, 'scent_group')).filter(Boolean);
      })()),
      Promise.resolve((() => {
        if (!productInfo.concentration) return null;
        const names = String(productInfo.concentration).split(',').map((s: string) => s.trim()).filter(Boolean);
        return names.map((n: string) => findTaxonomy(n, 'concentration')).filter(Boolean);
      })()),
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

    // Tag matching
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
        resolvedTagIds.push(matched._id);
        resolvedTagNames.push(matched.name);
        console.log(`✅ AI tag resolved: ${matched.name}`);
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

    // Category matching
    if (productInfo.category) {
      const names = String(productInfo.category).split(',').map((s: string) => s.trim()).filter(Boolean);
      const matched = names.map(n => FuzzyMatchCache.fuzzyFind(n, allCategories.lookup, (c: any) => c.name)).filter(Boolean);
      if (matched.length > 0) {
        productInfo.categories = matched.map((c: any) => c._id);
        productInfo.category = matched.map((c: any) => c.name).join(', ');
        console.log(`✅ category resolved: ${productInfo.category}`);
      } else {
        console.warn(`⚠️ Category "${productInfo.category}" not found in database`);
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