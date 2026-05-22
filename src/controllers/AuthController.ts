import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/AuthService.ts';
import { PostHogService } from '../services/PostHogService.ts';
import { verifyRefreshToken, generateTokens, hashPassword, comparePassword } from '../utils/auth.ts';
import { redis } from '../config/redis.ts';
import { UnauthorizedError } from '../utils/errors.ts';
import { UserRepository } from '../repositories/UserRepository.ts';
import { User } from '../models/User.ts';
import { Order } from '../models/Order.ts';
import mongoose from 'mongoose';

function computeMemberTier(totalSpent: number): 'MEMBER' | 'Bac' | 'Vang' | 'KimCuong' {
  if (totalSpent >= 30_000_000) return 'KimCuong';
  if (totalSpent >= 20_000_000) return 'Vang';
  if (totalSpent >= 10_000_000) return 'Bac';
  return 'MEMBER';
}

export class AuthController {
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

  /**
   * POST /api/auth/change-password
   * Body: { currentPassword, newPassword }
   * Yêu cầu: Đã xác thực (Authorization: Bearer <access_token>)
   */
  static async changePassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as { currentPassword: string; newPassword: string };
      const userId = (request as any).user?.userId;
      if (!userId) throw new UnauthorizedError('Vui lòng đăng nhập');

      const user = await UserRepository.findById(userId);
      if (!user) throw new UnauthorizedError('Người dùng không tồn tại');

      if (!user.passwordHash) {
        return reply.status(400).send({ success: false, message: 'Người dùng không có mật khẩu (OAuth)' });
      }

      const isMatch = await comparePassword(body.currentPassword, user.passwordHash);
      if (!isMatch) {
        return reply.status(400).send({ success: false, message: 'Mật khẩu hiện tại không đúng' });
      }

      const newHash = await hashPassword(body.newPassword);
      await UserRepository.update(userId, { passwordHash: newHash } as any);

      return reply.send({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/auth/update-profile
   * Body: { username, email }
   * Yêu cầu: Đã xác thực
   */
  static async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as {
        username?: string;
        email?: string;
        avatar?: string;
        fullName?: string;
        phoneNumber?: string;
        gender?: string;
      };
      const userId = (request as any).user?.userId;
      if (!userId) throw new UnauthorizedError('Vui lòng đăng nhập');

      const updateData: any = {};

      if (body.username !== undefined) {
        if (!body.username || body.username.trim().length < 3) {
          return reply.status(400).send({ success: false, message: 'Tên người dùng phải có ít nhất 3 ký tự' });
        }
        updateData.username = body.username.trim();
      }

      if (body.email !== undefined) {
        const trimmedEmail = body.email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          return reply.status(400).send({ success: false, message: 'Email không đúng định dạng' });
        }

        // Check if email already exists for another user
        const existingUser = await UserRepository.findByEmail(trimmedEmail);
        if (existingUser && existingUser._id.toString() !== userId) {
          return reply.status(400).send({ success: false, message: 'Email này đã được sử dụng bởi tài khoản khác' });
        }
        updateData.email = trimmedEmail;
      }

      if (body.avatar !== undefined && body.avatar.trim()) updateData.avatar = body.avatar.trim();
      if (body.fullName !== undefined) updateData.fullName = body.fullName.trim();
      if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber.trim();
      if (body.gender !== undefined) updateData.gender = body.gender;

      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({ success: false, message: 'Không có thông tin nào để cập nhật' });
      }

      const user = await UserRepository.findById(userId);
      if (!user) throw new UnauthorizedError('Người dùng không tồn tại');


      const updatedUser = await UserRepository.update(userId, updateData as any);
      if (!updatedUser) {
        return reply.status(404).send({ success: false, message: 'Không thể cập nhật thông tin' });
      }

      const { passwordHash, ...safeUser } = updatedUser as any;
 
       return reply.send({
         success: true,
         message: 'Cập nhật thông tin cá nhân thành công',
         data: safeUser
       });
     } catch (err: any) {
       return reply.status(500).send({ success: false, message: err.message });
     }
   }
 
   /**
    * GET /api/auth/me
    * Yêu cầu: Đã xác thực
    */
    static async getMe(request: FastifyRequest, reply: FastifyReply) {
      try {
        const userId = (request as any).user?.userId;
        if (!userId) throw new UnauthorizedError('Vui lòng đăng nhập');
  
        let user = await User.findById(userId).lean();
        if (!user) throw new UnauthorizedError('Người dùng không tồn tại');
  
        // Compute totalSpent từ các order đã delivered nếu chưa có
        let totalSpent = (user as any).totalSpent || 0;
        if (!totalSpent) {
          const result = await Order.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'delivered' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
          ]);
          totalSpent = (result[0]?.total || 0);
          await User.findByIdAndUpdate(userId, { totalSpent });
        }
  
        const tier = computeMemberTier(totalSpent);
        if ((user as any).memberTier !== tier) {
          await User.findByIdAndUpdate(userId, { memberTier: tier });
          (user as any).memberTier = tier;
        }
        (user as any).totalSpent = totalSpent;
  
        const { passwordHash, ...safeUser } = user as any;
  
        return reply.send({
          success: true,
          data: safeUser
        });
      } catch (err: any) {
        return reply.status(500).send({ success: false, message: err.message });
      }
    }
 }
