import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AIController } from '../controllers/AIController.ts';
import { AIPromptSchema, AIGenerateNameSchema } from '../types/feature.types.ts';

export async function aiRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/ai/generate - Gửi câu hỏi cho AI và nhận phản hồi
  server.post('/generate', {
    schema: {
      body: AIPromptSchema,
    },
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    },
    handler: AIController.generate,
  });

  // POST /api/ai/generate-product - AI tự động viết thông tin sản phẩm và tự động điền form
  server.post('/generate-product', {
    schema: {
      body: AIGenerateNameSchema,
    },
    handler: AIController.generateProduct,
  });

  // POST /api/ai/generate-brand - AI tự động viết câu chuyện thương hiệu và tự động điền form
  server.post('/generate-brand', {
    schema: {
      body: AIGenerateNameSchema,
    },
    handler: AIController.generateBrand,
  });

  // POST /api/ai/agent/run - Skill 13
  server.post('/agent/run', {
    schema: {
      body: AIPromptSchema,
    },
    handler: AIController.runAgent,
  });

  // POST /api/ai/support/chat - Hỗ trợ khách hàng đa tác nhân + Eval
  server.post('/support/chat', {
    schema: {
      body: AIPromptSchema,
    },
    handler: AIController.supportChat,
  });

  // POST /api/ai/chat - Streaming Vercel AI SDK
  server.post('/chat', {
    handler: AIController.chatStream,
  });

  // POST /api/ai/autocomplete - Gợi ý tự động hoàn thành thời gian thực
  server.post('/autocomplete', {
    handler: AIController.autocomplete,
  });

  // POST /api/ai/suggest-price - Gợi ý giá thị trường + % cộng thêm
  server.post('/suggest-price', {
    handler: AIController.suggestPrice,
  });
}
