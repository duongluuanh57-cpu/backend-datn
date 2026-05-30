import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AIChatController } from '../controllers/AIChatController.ts';
import { AICatalogController } from '../controllers/AICatalogController.ts';
import { AIVisionController } from '../controllers/AIVisionController.ts';
import { AICoreController } from '../controllers/AICoreController.ts';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';
import { AIPromptSchema, AIGenerateNameSchema } from '../types/feature.types.ts';

export async function aiRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/ai/generate - Gửi câu hỏi cho AI và nhận phản hồi
  server.post('/generate', {
    schema: {
      body: AIPromptSchema,
    },
    handler: AICoreController.generate,
  });

  // POST /api/ai/generate-product - AI tự động viết thông tin sản phẩm và tự động điền form
  server.post('/generate-product', {
    schema: {
      body: AIGenerateNameSchema,
    },
    handler: AICatalogController.generateProduct,
  });

  // POST /api/ai/generate-brand - AI tự động viết câu chuyện thương hiệu và tự động điền form
  server.post('/generate-brand', {
    schema: {
      body: AIGenerateNameSchema,
    },
    handler: AICatalogController.generateBrand,
  });

  // POST /api/ai/agent/run - Skill 13
  server.post('/agent/run', {
    schema: {
      body: AIPromptSchema,
    },
    handler: AICoreController.runAgent,
  });

  // POST /api/ai/support/chat - Hỗ trợ khách hàng đa tác nhân + Eval
  server.post('/support/chat', {
    schema: {
      body: AIPromptSchema,
    },
    handler: AIChatController.supportChat,
  });

  // POST /api/ai/chat - Streaming Vercel AI SDK (dành cho user)
  server.post('/chat', {
    handler: AIChatController.chatStream,
  });

  // POST /api/ai/admin/chat - Admin chat (yêu cầu auth + role ADMIN/SUBADMIN)
  server.post('/admin/chat', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')],
    handler: AIChatController.adminChat,
  });

  // POST /api/ai/autocomplete - Gợi ý tự động hoàn thành thời gian thực
  server.post('/autocomplete', {
    handler: AICatalogController.autocomplete,
  });

  // POST /api/ai/suggest-price - Gợi ý giá thị trường + % cộng thêm
  server.post('/suggest-price', {
    handler: AICatalogController.suggestPrice,
  });

  // POST /api/ai/feedback - Nhận đánh giá sao từ user, AI tự điều chỉnh và stream phản hồi
  server.post('/feedback', {
    handler: AIChatController.handleFeedback,
  });

  // POST /api/ai/scan-gallery-image - AI quét ảnh và tự động điền tiêu đề và câu trích dẫn song ngữ
  server.post('/scan-gallery-image', {
    handler: AIVisionController.scanGalleryImage,
  });
    // GET /api/ai/health - Health check cho AI services
  server.get('/health', {
    handler: AICoreController.healthCheck,
  });
}
