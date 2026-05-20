import type { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../services/AIService.ts';

export class AICoreController {
  static async generate(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { prompt } = req.body as { prompt: string };
      const response = await AIService.generateResponse(prompt);
      return reply.status(200).send({ success: true, data: response });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  static async runAgent(req: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({ success: true });
  }
}
