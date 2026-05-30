import type { FastifyInstance } from 'fastify';
import { ContentController } from '../controllers/content/ContentController.ts';

export async function contentRoutes(app: FastifyInstance) {
  app.get('/search', ContentController.search);
}
