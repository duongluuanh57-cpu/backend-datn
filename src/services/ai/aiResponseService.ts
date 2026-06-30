/**
 * aiResponseService — Delegate sang aiInteractionService (Vercel AI SDK)
 * 
 * Giữ signature cũ để backward compatible
 */
import { generateTextResponse } from './aiInteractionService.ts';

/**
 * generateResponse — Sử dụng Vercel AI SDK Interactions API
 */
export async function generateResponse(prompt: string, userId?: string, modelName: string = 'gemini-3.1-flash-lite-preview') {
  return generateTextResponse(prompt);
}
