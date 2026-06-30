/**
 * aiEmbedding — Delegate sang aiInteractionService (Vercel AI SDK)
 * 
 * Giữ signature cũ để backward compatible
 */
import { generateEmbeddingVector } from './aiInteractionService.ts';
import crypto from 'crypto';
import { redis } from '../../config/redis.ts';

/**
 * Generate embedding vector for text, with deterministic fallback
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Cache embedding trong Redis 1 ngay (cung cau hoi → cung vector)
  const cacheKey = `embedding:${crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex')}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[Embedding] Cache hit for: "${text.substring(0, 40)}..."`);
        return parsed;
      }
    }
  } catch {} /* ignore */

  try {
    const vector = await generateEmbeddingVector(text);
    // Cache 24h
    try { await redis.set(cacheKey, JSON.stringify(vector), 'EX', 86400); } catch {}
    return vector;
  } catch (error) {
    console.warn('⚠️ [Embedding] Using deterministic fallback:', error);
    // Deterministic fallback: generate pseudo-random 768-dim vector from hash
    const hash = crypto.createHash('sha256').update(text).digest();
    const dims = 768;
    const vec = new Array(dims);
    let sum = 0;
    for (let i = 0; i < dims; i++) {
      const seed = hash[(i * 31) % 32] ^ hash[(i * 7 + 13) % 32];
      const val = (seed / 128) - 1;
      vec[i] = val;
      sum += val * val;
    }
    const norm = Math.sqrt(sum);
    for (let i = 0; i < dims; i++) {
      vec[i] /= norm;
    }
    return vec;
  }
}
