import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AuthController } from '../controllers/AuthController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import { RegisterSchema, LoginSchema, ChangePasswordSchema } from '../types/user.types.ts';

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

  // Đổi mật khẩu cho user đang đăng nhập
  typedApp.post('/change-password', {
    preHandler: authMiddleware,
    schema: {
      body: ChangePasswordSchema
    }
  }, AuthController.changePassword);

  // Lấy thông tin người dùng đang đăng nhập
  typedApp.get('/me', {
    preHandler: authMiddleware
  }, AuthController.getMe);

  // Cập nhật thông tin cá nhân
  typedApp.patch('/update-profile', {
    preHandler: authMiddleware,
    schema: {
      body: z.object({
        username: z.string().min(3, 'Tên người dùng phải có ít nhất 3 ký tự').max(50).optional(),
        email: z.string().email('Email không đúng định dạng').optional(),
        fullName: z.string().max(100).optional(),
        phoneNumber: z.string().max(20).optional(),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
        address: z.string().max(200).optional(),
        province: z.string().max(100).optional(),
        district: z.string().max(100).optional(),
        avatar: z.string().optional()
      })
    }
  }, AuthController.updateProfile);
}

