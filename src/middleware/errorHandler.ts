import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../utils/errors.ts';
import * as Sentry from '@sentry/node';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  // Bắn lỗi 500 (lỗi không lường trước) lên Sentry để theo dõi
  if (!(error instanceof AppError) && !error.validation) {
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

  // Các lỗi còn lại (Internal Server Error)
  return reply.status(500).send({
    success: false,
    message: 'Hệ thống gặp sự cố (Internal Server Error)',
  });
}
