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

  static async healthCheck(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { AIService } = await import('../services/AIService.ts');
      const { AgentService } = await import('../services/AgentService.ts');
      const { checkRedisHealth } = await import('../config/redis.ts');

      // Check AI Service health
      const aiServiceHealth = await AIService.healthCheck();
      
      // Check Agent Service health  
      const agentServiceHealth = await AgentService.healthCheck();
      
      // Check Redis health
      const redisHealth = await checkRedisHealth();

      const overallHealth = 
        aiServiceHealth.status === 'healthy' && 
        agentServiceHealth.status === 'healthy' && 
        redisHealth;

      return reply.status(overallHealth ? 200 : 503).send({
        status: overallHealth ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          aiService: aiServiceHealth,
          agentService: agentServiceHealth,
          redis: {
            status: redisHealth ? 'healthy' : 'unhealthy',
            connected: redisHealth
          }
        }
      });
    } catch (error: any) {
      console.error('❌ [AI Health Check] Error:', error);
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }
}