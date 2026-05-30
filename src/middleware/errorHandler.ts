import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../utils/errors.ts';
import * as Sentry from '@sentry/node';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  // Bắn lỗi 500 (lỗi không lường trước) lên Sentry để theo dõi
  // Skip rate-limit (429) vì không phải lỗi thật
  const statusCode = (error as any).statusCode || 500;
  if (!(error instanceof AppError) && !error.validation && statusCode !== 429) {
    Sentry.captureException(error);
  }

  // In lỗi ra log của Fastify (Pino)
  request.log.error(error);

  // Nếu là lỗi nghiệp vụ do chúng ta chủ động quăng ra (AppError)
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      message: error.message,
    });
  }

  // Nếu là lỗi Validation của Fastify (thường sinh ra do Zod schema)
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      message: 'Lỗi xác thực dữ liệu (Validation Failed)',
      errors: error.validation,
    });
  }

  // Các lỗi còn lại — giữ nguyên statusCode từ plugin (vd: 429 rate-limit)
  return reply.status(statusCode).send({
    success: false,
    message: statusCode === 429
      ? 'Vượt quá giới hạn yêu cầu, vui lòng thử lại sau'
      : 'Hệ thống gặp sự cố (Internal Server Error)',
  });
}
