import 'dotenv/config';
import { buildApp } from './app.ts';
import { initSentry } from './config/sentry.ts';

// Khởi tạo Sentry đầu tiên để bắt lỗi
initSentry();

const app = buildApp();
const PORT = parseInt(process.env.PORT || '4000', 10); // Dùng PORT từ Render, fallback 4000 cho local
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
  try {
    // Khởi động server
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Elite SaaS Backend is live at: ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
