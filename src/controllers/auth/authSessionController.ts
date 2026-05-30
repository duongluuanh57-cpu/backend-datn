import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../../services/AuthService.ts';
import { PostHogService } from '../../services/PostHogService.ts';
import { verifyRefreshToken, generateTokens } from '../../utils/auth.ts';
import { redis } from '../../config/redis.ts';
import { UnauthorizedError } from '../../utils/errors.ts';
import { UserRepository } from '../../repositories/UserRepository.ts';

export class AuthSessionController {
  static async register(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as any;
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const result = await AuthService.register(data, tenantId);
    
    // PostHog Tracking: Đăng ký thành công
    PostHogService.capture(result.user.id.toString(), 'user_registered', {
      method: 'email',
      tenantId
    });

    return reply.status(201).send({
      success: true,
      message: 'Đăng ký thành công',
      data: result,
    });
  }

  static async login(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as any;
    const metadata = {
      ip: request.ip,
      userAgent: request.headers['user-agent'] || 'unknown'
    };
    const result = await AuthService.login(data, metadata);

    // PostHog Tracking: Đăng nhập thành công
    PostHogService.capture(result.user.id.toString(), 'user_logged_in', {
      ...metadata
    });

    return reply.send({
      success: true,
      message: 'Đăng nhập thành công',
      data: result,
    });
  }

  /**
   * Dùng Refresh Token để cấp Access Token mới (không cần đăng nhập lại)
   * POST /api/auth/refresh
   */
  static async refresh(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) throw new UnauthorizedError('Refresh token là bắt buộc');

    // Kiểm tra Blacklist trước
    const isBlacklisted = await redis.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) throw new UnauthorizedError('Token đã bị thu hồi');

    // Verify refresh token (bao gồm issuer, algorithm, type checks)
    const { userId } = verifyRefreshToken(refreshToken);

    // Tìm user để lấy role mới nhất từ DB
    const user = await UserRepository.findById(userId);
    if (!user) throw new UnauthorizedError('Người dùng không tồn tại');

    const tokens = generateTokens(userId, user.role);

    return reply.send({
      success: true,
      message: 'Cấp lại token thành công',
      data: tokens,
    });
  }

  /**
   * Đăng xuất — Đưa Refresh Token vào Blacklist trong Redis
   * POST /api/auth/logout
   */
  static async logout(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) throw new UnauthorizedError('Refresh token là bắt buộc');

    // Đưa token vào Blacklist — hết hạn sau 7 ngày (bằng TTL của refresh token)
    await redis.set(`blacklist:${refreshToken}`, '1', 'EX', 60 * 60 * 24 * 7);

    return reply.send({
      success: true,
      message: 'Đăng xuất thành công',
    });
  }
}