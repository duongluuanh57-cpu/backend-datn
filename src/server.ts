import 'dotenv/config';
import { buildApp } from './app.ts';
import { initSentry } from './config/sentry.ts';
import { QStashService } from './services/QStashService.ts';

// Khởi tạo Sentry đầu tiên để bắt lỗi
initSentry();

const app = buildApp();
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function registerCronJobs() {
  if (!process.env.QSTASH_TOKEN) {
    console.log('ℹ️ QStash not configured — skipping cron registration');
    return;
  }
  try {
    await QStashService.createSchedule('/api/jobs/self-heal', '0 * * * *', { source: 'cron' });
    console.log('✅ Registered cron: self-heal (hourly)');
  } catch {
    console.log('ℹ️ Cron self-heal already registered or QStash unavailable');
  }
  try {
    await QStashService.createSchedule('/api/jobs/failover-check', '*/5 * * * *', { source: 'cron' });
    console.log('✅ Registered cron: failover-check (every 5 min)');
  } catch {
    console.log('ℹ️ Cron failover-check already registered or QStash unavailable');
  }
  try {
    await QStashService.createSchedule('/api/jobs/daily-cleanup', '0 0 * * *', { source: 'cron' });
    console.log('✅ Registered cron: daily-cleanup (daily)');
  } catch {
    console.log('ℹ️ Cron daily-cleanup already registered or QStash unavailable');
  }
}

const start = async () => {
  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`Backend is live at: ${address}`);

    // Đăng ký cron jobs sau khi server đã sẵn sàng
    await registerCronJobs();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
