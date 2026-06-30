/**
 * aiStreamService — Delegate sang aiInteractionService (Vercel AI SDK Interactions API)
 * 
 * Giữ signature cũ để backward compatible
 */
import { createChatStream as _createChatStream } from './aiInteractionService.ts';

/**
 * createChatStream — Sử dụng Vercel AI SDK Interactions API
 */
export async function createChatStream(messages: any[], systemPrompt?: string, image?: string): Promise<Response> {
  return _createChatStream(messages, systemPrompt, image);
}

