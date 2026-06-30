import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../../services/AuthService.ts';
import { hashPassword, comparePassword } from '../../utils/auth.ts';
import { UnauthorizedError } from '../../utils/errors.ts';
import { UserRepository } from '../../repositories/UserRepository.ts';
import { User } from '../../models/User.ts';
import { UserAddress } from '../../models/UserAddress.ts';
import { Order } from '../../models/Order.ts';
import mongoose from 'mongoose';

function computeMemberTier(totalSpent: number): 'MEMBER' | 'Bac' | 'Vang' | 'KimCuong' {
  if (totalSpent >= 30_000_000) return 'KimCuong';
  if (totalSpent >= 20_000_000) return 'Vang';
  if (totalSpent >= 10_000_000) return 'Bac';
  return 'MEMBER';
}

export class AuthProfileController {
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
        address?: string;
        province?: string;
        district?: string;
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
      if (body.address !== undefined) updateData.address = body.address.trim();
      if (body.province !== undefined) updateData.province = body.province.trim();
      if (body.district !== undefined) updateData.district = body.district.trim();

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

      // Luôn recalculate totalSpent từ orders đã delivered (real-time, không lưu DB)
      const result = await Order.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]);
      const totalSpent = result[0]?.total || 0;

      const tier = computeMemberTier(totalSpent);
      if ((user as any).memberTier !== tier) {
        await User.findByIdAndUpdate(userId, { memberTier: tier });
        (user as any).memberTier = tier;
      }
      (user as any).totalSpent = totalSpent;

      // Lấy địa chỉ mặc định của user
      const defaultAddress = await UserAddress.findOne({ userId: new mongoose.Types.ObjectId(userId), isDefault: true }).lean();

      const { passwordHash, ...safeUser } = user as any;

      return reply.send({
        success: true,
        data: {
          ...safeUser,
          defaultAddress: defaultAddress || null,
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  }
}
