import { UserRepository } from '../repositories/UserRepository.ts';
import type { RegisterInput, LoginInput } from '../types/user.types.ts';
import { hashPassword, comparePassword, generateTokens } from '../utils/auth.ts';
import { ValidationError, UnauthorizedError } from '../utils/errors.ts';
import { QStashService } from './QStashService.ts';
import { PostHogService } from './PostHogService.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { redis } from '../config/redis.ts';

export class AuthService {
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

  static async login(data: LoginInput & { rememberMe?: boolean }, metadata: { ip: string, userAgent: string }) {
    // 1. Tìm user theo email
    const user = await UserRepository.findByEmail(data.email);
    if (!user) throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');

    // Kiểm tra trạng thái tài khoản (Bảo mật 2026)
    if (user.status === 'suspended') {
      throw new UnauthorizedError('Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.');
    }
    if (user.status === 'inactive') {
      throw new UnauthorizedError('Tài khoản của bạn chưa được kích hoạt.');
    }

    // 2. Đối chiếu mật khẩu
    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
       await AuditLog.create({
        userId: user._id,
        action: 'LOGIN',
        resource: 'User',
        tenantId: (user as any).tenantId || 'default',
        metadata: { ...metadata },
        status: 'FAILURE'
      });
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    // 3. Session Hardening: Lưu thông tin session vào Redis
    const sessionTTL = data.rememberMe ? 60 * 60 * 24 * 7 : 900; // 7 days or 15 mins
    await redis.set(`session:${user._id}:${metadata.ip}`, JSON.stringify({
      userAgent: metadata.userAgent,
      lastLogin: new Date().toISOString(),
      rememberMe: data.rememberMe
    }), 'EX', sessionTTL);

    // 4. Audit Logging
    await AuditLog.create({
      userId: user._id,
      action: 'LOGIN',
      resource: 'User',
      tenantId: (user as any).tenantId || 'default',
      metadata: { ...metadata, rememberMe: data.rememberMe },
      status: 'SUCCESS'
    });

    // 5. Track Analytics (PostHog)
    PostHogService.capture(user._id.toString(), 'user_logged_in', { ...metadata, rememberMe: data.rememberMe });

    // 6. Sinh bộ đôi Token
    const tokens = generateTokens(user._id.toString(), user.role, data.rememberMe);
    
    return {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        memberTier: (user as any).memberTier || 'MEMBER',
        status: (user as any).status || 'active',
        fullName: (user as any).fullName || '',
        phoneNumber: (user as any).phoneNumber || '',
        gender: (user as any).gender || '',
        address: (user as any).address || '',
        province: (user as any).province || '',
        district: (user as any).district || '',
        tenantId: (user as any).tenantId,
        createdAt: user.createdAt
      },
      tokens
    };
  }

  /**
   * Đăng xuất & Blacklist Refresh Token (Bảo mật 2026)
   */
  static async logout(refreshToken: string, userId: string) {
    // Đưa Refresh Token vào Blacklist trong Redis (Hết hạn sau 7 ngày theo config)
    const SEVEN_DAYS = 7 * 24 * 60 * 60;
    await redis.set(`blacklist:${refreshToken}`, 'true', 'EX', SEVEN_DAYS);

    // Lấy user để xác định tenantId cho AuditLog
    const user = await UserRepository.findById(userId);
    const tenantId = user ? (user as any).tenantId : 'default';

    // Audit Log
    await AuditLog.create({
      userId,
      action: 'LOGOUT',
      resource: 'User',
      tenantId,
      status: 'SUCCESS'
    });

    PostHogService.capture(userId, 'user_logged_out');
    
    return { success: true };
  }
}
