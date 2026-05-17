import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AuthController } from '../controllers/AuthController.ts';
import { RegisterSchema, LoginSchema } from '../types/user.types.ts';

export async function authRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post('/register', {
    schema: { body: RegisterSchema },
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, AuthController.register);

  typedApp.post('/login', {
    schema: { body: LoginSchema },
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, AuthController.login);

  // Cấp lại Access Token bằng Refresh Token
  typedApp.post('/refresh', {
    schema: {
      body: z.object({ refreshToken: z.string().min(1) })
    }
  }, AuthController.refresh);

  // Đăng xuất — đưa Refresh Token vào Blacklist
  typedApp.post('/logout', {
    schema: {
      body: z.object({ refreshToken: z.string().min(1) })
    }
  }, AuthController.logout);
}
