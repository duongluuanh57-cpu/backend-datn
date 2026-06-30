import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

/**
 * CSRF Middleware — tạo & validate token cho tất cả POST/PUT/PATCH/DELETE của Admin.
 * Token được lưu trong session cookie, kiểm tra match với hidden field `_csrf`.
 */
const TOKEN_COOKIE = 'csrf_token';
const FIELD_NAME = '_csrf';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function csrfProtection(req: FastifyRequest, reply: FastifyReply) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    // Tạo token mới nếu chưa có
    const cookieHeader = req.headers.cookie || '';
    if (!cookieHeader.includes(TOKEN_COOKIE)) {
      const newToken = generateCsrfToken();
      reply.header('Set-Cookie',
        `${TOKEN_COOKIE}=${newToken}; Path=/; SameSite=Lax; HttpOnly`);
    }
    return;
  }

  // Validate CSRF cho POST/PUT/PATCH/DELETE
  const cookieHeader = req.headers.cookie || '';
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]*)`));
  const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  const body: any = req.body || {};
  const formToken = body[FIELD_NAME];

  // Xóa _csrf khỏi body để không lẫn vào data
  if (body[FIELD_NAME]) delete body[FIELD_NAME];

  if (!cookieToken || !formToken || cookieToken !== formToken) {
    return reply.status(403).send('Invalid CSRF token — vui lòng refresh trang và thử lại.');
  }
}
