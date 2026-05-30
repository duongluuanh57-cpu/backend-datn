import { UserRepository } from '../../repositories/UserRepository.ts';
import type { RegisterInput } from '../../types/user.types.ts';
import { hashPassword, generateTokens } from '../../utils/auth.ts';
import { ValidationError } from '../../utils/errors.ts';
import { QStashService } from '../QStashService.ts';
import { PostHogService } from '../PostHogService.ts';
import { AuditLog } from '../../models/AuditLog.ts';

export class AuthRegisterService {
  static async register(data: RegisterInput, tenantId: string = 'default') {
    // 1. Kiểm tra email/username đã tồn tại chưa
    const existingEmail = await UserRepository.findByEmail(data.email);
    if (existingEmail) throw new ValidationError('Email đã được sử dụng');

    const existingUsername = await UserRepository.findByUsername(data.username);
    if (existingUsername) throw new ValidationError('Username đã được sử dụng');

    // 2. Mã hóa mật khẩu
    const passwordHash = await hashPassword(data.password);

    // 3. Tạo User mới trong DB với tenantId
    const newUser = await UserRepository.create({
      username: data.username,
      email: data.email,
      passwordHash,
      role: 'USER',
      memberTier: 'MEMBER',
      tenantId // Gán tenantId cho SaaS
    });

    // 4. Audit Logging
    await AuditLog.create({
      userId: newUser._id,
      action: 'REGISTER',
      resource: 'User',
      tenantId: newUser.tenantId || 'default',
      metadata: { email: newUser.email },
      status: 'SUCCESS'
    });

    // 5. Đẩy job gửi email chào mừng vào QStash
    await QStashService.publish('/welcome-email', {
      userId: newUser._id.toString(),
      email: newUser.email,
      name: newUser.username
    }).catch(err => console.error('[QStash Error] Failed to queue welcome email:', err));

    // 6. Track Analytics (PostHog)
    PostHogService.identify(newUser._id.toString(), {
      email: newUser.email,
      username: newUser.username,
      role: newUser.role,
      tenantId: newUser.tenantId,
      created_at: newUser.createdAt,
    });
    PostHogService.capture(newUser._id.toString(), 'user_registered', { method: 'credentials' });

    // 7. Sinh bộ đôi JWT Token
    const tokens = generateTokens(newUser._id.toString(), newUser.role);

    return {
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        memberTier: newUser.memberTier,
        status: newUser.status,
        fullName: newUser.fullName || '',
        phoneNumber: newUser.phoneNumber || '',
        gender: newUser.gender || '',
        address: newUser.address || '',
        province: newUser.province || '',
        district: newUser.district || '',
        tenantId: newUser.tenantId,
        createdAt: newUser.createdAt
      },
      tokens
    };
  }
}