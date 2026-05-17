import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { encrypt, decrypt } from '../utils/crypto.ts';

export class TwoFactorService {
  /**
   * Tạo Secret key và mã QR Code cho người dùng quét bằng app (Google Authenticator)
   */
  static async generateSetup(email: string) {
    const secret = speakeasy.generateSecret({
      name: `SaaS Core 2026 (${email})`,
      length: 32,
    });

    // Tạo ảnh QR dưới dạng Base64 để hiển thị trên Frontend
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,  // Lưu key dạng base32 vào DB
      qrCodeUrl,
    };
  }

  /**
   * Xác minh mã 6 số nhập vào từ Authenticator App có khớp với Secret không
   * (Hỗ trợ giải mã secret nếu nó được truyền vào dưới dạng đã mã hóa)
   */
  static verifyToken(token: string, secret: string): boolean {
    let rawSecret = secret;
    
    // Nếu secret có định dạng iv:tag:content thì ta giải mã trước
    if (secret.includes(':')) {
      try {
        rawSecret = decrypt(secret);
      } catch (err) {
        console.error('[TwoFactorService] Decryption failed', err);
      }
    }

    return speakeasy.totp.verify({
      secret: rawSecret,
      encoding: 'base32',
      token,
      window: 1, 
    });
  }

  /**
   * Mã hóa secret để lưu vào DB
   */
  static encryptSecret(secret: string): string {
    return encrypt(secret);
  }
}
