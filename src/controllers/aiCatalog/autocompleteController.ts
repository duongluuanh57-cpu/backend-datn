import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../../services/AIService.ts';
import { redis } from '../../config/redis.ts';

export async function autocomplete(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { field, currentValue, context } = req.body as {
      field: string;
      currentValue: string;
      context?: any;
    };

    if (!field) {
      return reply.status(400).send({ error: 'Field is required' });
    }

    const isEmpty = !currentValue || !currentValue.trim();

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
      if (isEmpty) {
        systemPrompt = `
Suggest 3 popular luxury perfume names for a search heading.
Return exactly 3 lines, one suggestion per line. No markdown, no numbers.
Keep each suggestion under 30 characters.
Example:
Dior Sauvage
Chanel No 5
Tom Ford Oud Wood
`;
      } else {
        systemPrompt = `
Suggest 3 luxury perfume names continuing: "${currentValue}".
Return exactly 3 lines, one suggestion per line. No markdown, no numbers.
Example:
Sweet Vanilla Bourbon
Sweet Violet Oud
Sweet Amber Nights
`;
      }
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

    // Generate response from Gemini
    const response = await AIService.generateResponse(systemPrompt, undefined, 'gemini-3.1-flash-lite');

    // Clean up response line-by-line
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