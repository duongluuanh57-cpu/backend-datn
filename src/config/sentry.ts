import * as Sentry from '@sentry/node';

export function initSentry() {
  if (process.env.NODE_ENV !== 'production') {
    return; // Không kích hoạt Sentry ở môi trường Dev
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0', // APP_VERSION sẽ được truyền qua CI/CD
    tracesSampleRate: 1.0, 
  });
}

// Bắt lỗi Unhandled Rejections và Exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  Sentry.captureException(error);
  process.exit(1); // Nên crash app để container restart lại khi có lỗi chí mạng
});
