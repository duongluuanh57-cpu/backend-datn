/**
 * AIChatController — Barrel file (re-export từ các module nhỏ hơn)
 *
 * File này được giữ lại để backward compatibility.
 * Code thực tế đã được tách vào thư mục `controllers/aiChat/`:
 *   - chatStreamController.ts → chatStream, supportChat
 *   - adminChatController.ts  → adminChat
 *   - feedbackController.ts   → handleFeedback
 */
export { chatStream, supportChat } from './aiChat/chatStreamController.ts';
export { adminChat } from './aiChat/adminChatController.ts';
export { handleFeedback } from './aiChat/feedbackController.ts';

// Re-import cho backward-compatible class
import { chatStream as _chatStream, supportChat as _supportChat } from './aiChat/chatStreamController.ts';
import { adminChat as _adminChat } from './aiChat/adminChatController.ts';
import { handleFeedback as _handleFeedback } from './aiChat/feedbackController.ts';

import type { FastifyRequest, FastifyReply } from 'fastify';

// ============================================================
// Backward-compatible AIChatController class
// Giữ nguyên tên class + method signatures để không break imports
// ============================================================
export class AIChatController {
  static async chatStream(req: FastifyRequest, reply: FastifyReply) {
    return _chatStream(req, reply);
  }

  static async supportChat(req: FastifyRequest, reply: FastifyReply) {
    return _supportChat(req, reply);
  }

  static async adminChat(req: FastifyRequest, reply: FastifyReply) {
    return _adminChat(req, reply);
  }

  static async handleFeedback(req: FastifyRequest, reply: FastifyReply) {
    return _handleFeedback(req, reply);
  }
}