import crypto from 'crypto';
import { getGeminiClient } from './aiClient.ts';

/**
 * Generate embedding vector for text, with deterministic fallback
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const client = getGeminiClient();
    const embeddingModel = client.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
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