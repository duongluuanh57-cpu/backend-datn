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

  // POST /api/ai/generate-brand - AI tự động viết câu chuyện thương hiệu và tự động điền form
  server.post('/generate-brand', {
    schema: {
      body: AIGenerateNameSchema,
    },
    handler: AICatalogController.generateBrand,
  });

  // POST /api/ai/generate-user - AI tạo thông tin người dùng
  server.post('/generate-user', {
    handler: AICatalogController.generateUser,
  });

  // POST /api/ai/generate-category - AI tạo danh mục
  server.post('/generate-category', {
    handler: AICatalogController.generateCategory,
  });

  // POST /api/ai/generate-tag - AI tạo tag
  server.post('/generate-tag', {
    handler: AICatalogController.generateTag,
  });

  // POST /api/ai/generate-voucher - AI tạo voucher
  server.post('/generate-voucher', {
    handler: AICatalogController.generateVoucher,
  });

  // POST /api/ai/create-user - Tạo user từ dữ liệu AI
  server.post('/create-user', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')],
    handler: AICatalogController.createUserFromAI,
  });

  // POST /api/ai/create-category - Tạo category từ dữ liệu AI
  server.post('/create-category', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')],
    handler: AICatalogController.createCategoryFromAI,
  });

  // POST /api/ai/create-tag - Tạo tag từ dữ liệu AI
  server.post('/create-tag', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')],
    handler: AICatalogController.createTagFromAI,
  });

  // POST /api/ai/create-voucher - Tạo voucher từ dữ liệu AI
  server.post('/create-voucher', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')],
    handler: AICatalogController.createVoucherFromAI,
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

  // ── Product Interview (Multi-step product creation) ──
  // POST /api/ai/admin/product-interview - Bắt đầu/tiếp tục interview
  // GET /api/ai/admin/product-interview/check?message=... - Kiểm tra intent
  const { handleProductInterview, checkProductCreationIntent } = await import('../controllers/aiChat/productInterviewController.ts');
  server.post('/admin/product-interview', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')],
    handler: handleProductInterview,
  });
  server.get('/admin/product-interview/check', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUBADMIN')],
    handler: checkProductCreationIntent,
  });
}
