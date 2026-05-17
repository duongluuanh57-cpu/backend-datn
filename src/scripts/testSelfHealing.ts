import { SelfHealingService } from '../services/SelfHealingService.ts';
import { runHealthChecks } from '../services/HealthCheckService.ts';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSelfHealing() {
  console.log('🚀 Đang chạy Bài Test 3: Self-Healing & Health Check...');
  
  // 1. Chạy Health Check ban đầu
  console.log('--- Trạng thái hiện tại ---');
  const health = await runHealthChecks();
  console.log(JSON.stringify(health.body, null, 2));

  // 2. Kích hoạt Self-Healing
  console.log('\n--- Kích hoạt Self-Healing ---');
  await SelfHealingService.performMaintenance();
  
  console.log('\n✅ Hoàn tất Bài Test 3!');
}

testSelfHealing().catch(console.error);
