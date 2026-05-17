import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { TwoFactorController } from '../controllers/TwoFactorController.ts';
import { Enable2FASchema, Verify2FASchema } from '../types/feature.types.ts';

export async function twoFactorRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/2fa/setup - Tạo QR Code để quét
  server.post('/setup', {
    schema: {
      body: z.object({ email: z.string().email() }),
    },
    handler: TwoFactorController.setup,
  });

  // POST /api/2fa/enable - Kích hoạt 2FA sau khi quét QR thành công
  server.post('/enable', {
    schema: {
      body: Enable2FASchema,
    },
    handler: TwoFactorController.enable,
  });

  // POST /api/2fa/verify - Xác minh OTP khi đăng nhập
  server.post('/verify', {
    schema: {
      body: Verify2FASchema,
    },
    handler: TwoFactorController.verify,
  });
}
