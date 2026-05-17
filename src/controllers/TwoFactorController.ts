import type { FastifyRequest, FastifyReply } from 'fastify';
import { TwoFactorService } from '../services/TwoFactorService.ts';
import { UserRepository } from '../repositories/UserRepository.ts';
import type { Verify2FAInput, Enable2FAInput } from '../types/feature.types.ts';
import { ValidationError, NotFoundError } from '../utils/errors.ts';

export class TwoFactorController {
  /**
   * Bước 1: Tạo Secret & QR Code cho User quét bằng app Authenticator
   * POST /api/2fa/setup
   */
  static async setup(req: FastifyRequest, reply: FastifyReply) {
    // TODO: Lấy userId từ JWT token sau khi có AuthMiddleware
    const { email } = req.body as { email: string };

    const user = await UserRepository.findByEmail(email);
    if (!user) throw new NotFoundError('Không tìm thấy người dùng');

    const { secret, qrCodeUrl } = await TwoFactorService.generateSetup(email);

    // Mã hóa và lưu secret vào DB (Chưa enable cho đến khi verify thành công)
    const encryptedSecret = TwoFactorService.encryptSecret(secret);
    await UserRepository.update(user._id.toString(), { twoFactorSecret: encryptedSecret } as any);

    return reply.status(200).send({
      success: true,
      message: 'Quét mã QR bằng Google Authenticator hoặc Authy',
      data: {
        qrCodeUrl,   // Ảnh Base64 hiển thị trên Frontend
      },
    });
  }

  /**
   * Bước 2: Xác minh mã OTP và kích hoạt 2FA cho tài khoản
   * POST /api/2fa/enable
   */
  static async enable(req: FastifyRequest, reply: FastifyReply) {
    const { token, userId } = req.body as Enable2FAInput;

    const user = await UserRepository.findById(userId);
    if (!user) throw new NotFoundError('Không tìm thấy người dùng');
    if (!user.twoFactorSecret) throw new ValidationError('Vui lòng thiết lập 2FA trước');

    const isValid = TwoFactorService.verifyToken(token, user.twoFactorSecret);
    if (!isValid) throw new ValidationError('Mã OTP không đúng hoặc đã hết hạn');

    // Kích hoạt 2FA trong DB
    await UserRepository.update(userId, { twoFactorEnabled: true } as any);

    return reply.status(200).send({
      success: true,
      message: 'Bảo mật 2 lớp đã được kích hoạt thành công!',
    });
  }

  /**
   * Xác minh mã OTP trong lúc đăng nhập (nếu User đã bật 2FA)
   * POST /api/2fa/verify
   */
  static async verify(req: FastifyRequest, reply: FastifyReply) {
    const { token, userId } = req.body as { token: string, userId: string };

    const user = await UserRepository.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new ValidationError('Người dùng không tồn tại hoặc chưa bật 2FA');
    }

    const isValid = TwoFactorService.verifyToken(token, user.twoFactorSecret);
    if (!isValid) throw new ValidationError('Mã OTP không đúng hoặc đã hết hạn');

    return reply.status(200).send({
      success: true,
      message: 'Xác minh OTP thành công',
    });
  }
}
