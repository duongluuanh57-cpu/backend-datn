import type { FastifyInstance } from 'fastify';
import { OAuthController } from '../controllers/OAuthController.ts';

export async function oauthRoutes(app: FastifyInstance) {
  // Google OAuth — Bước 1: Redirect sang Google
  app.get('/google', OAuthController.initiateGoogle);

  // Google OAuth — Bước 2: Nhận callback từ Google
  app.get('/google/callback', OAuthController.googleCallback);
}
