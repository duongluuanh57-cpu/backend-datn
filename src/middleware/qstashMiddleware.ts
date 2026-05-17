import { Receiver } from '@upstash/qstash';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ConflictError } from '../utils/errors.ts';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

/**
 * qstashMiddleware — Xác minh chữ ký & Chống xử lý trùng lặp (Advanced Pattern)
 */
export async function qstashMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const signature = req.headers['upstash-signature'] as string;
  const messageId = req.headers['upstash-message-id'] as string;
  
  if (!signature || !messageId) {
    throw new UnauthorizedError('Missing Upstash credentials');
  }

  // 1. Chống xử lý trùng lặp (Idempotency) bằng Redis
  // QStash có thể retry, nên ta cần chặn nếu messageId đã được xử lý thành công
  const isProcessed = await req.server.redis.get(`qstash:processed:${messageId}`);
  if (isProcessed) {
    req.log.warn(`Message ${messageId} already processed. Skipping...`);
    return reply.status(200).send({ success: true, message: 'Already processed' });
  }

  // 2. Xác minh chữ ký sử dụng RAW BODY (Chuẩn nhất)
  // Lấy rawBody từ plugin fastify-raw-body đã đăng ký trong app.ts
  const rawBody = (req as any).rawBody;

  const isValid = await receiver.verify({
    signature,
    body: rawBody,
    url: `${req.protocol}://${req.hostname}${req.url}`,
  }).catch(() => false);

  if (!isValid) {
    throw new UnauthorizedError('Invalid Upstash signature');
  }

  // Đánh dấu là đang xử lý (có thể thêm logic này sau khi xử lý thành công ở controller)
  // Hoặc lưu vào request để controller dùng
  (req as any).qstashMessageId = messageId;
}
