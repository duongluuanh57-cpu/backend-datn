import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Redis } from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error('REDIS_URL is not defined in .env!');
  process.exit(1);
}

async function main() {
  console.log('Connecting to Upstash Redis...');
  const client = new Redis(redisUrl);
  
  console.log('Searching for price cache keys...');
  const keys = await client.keys('ai_price_cache:*');
  console.log(`Found ${keys.length} price cache keys:`);
  console.log(keys);
  
  if (keys.length > 0) {
    const deletedCount = await client.del(...keys);
    console.log(`Successfully deleted ${deletedCount} price cache keys!`);
  } else {
    console.log('No price cache keys to delete.');
  }

  // Clear related autocomplete and context keys for Sweet Vanilla Bourbon
  const sweetKeys = await client.keys('*sweet*');
  const vanillaKeys = await client.keys('*vanilla*');
  const contextKeys = await client.keys('ai:product-context:*');
  const allOtherKeys = [...new Set([...sweetKeys, ...vanillaKeys, ...contextKeys])];
  
  console.log(`Found ${allOtherKeys.length} matching autocomplete / product context cache keys:`);
  console.log(allOtherKeys);
  
  if (allOtherKeys.length > 0) {
    const deletedCountOther = await client.del(...allOtherKeys);
    console.log(`Successfully deleted ${deletedCountOther} related cache keys.`);
  }

  console.log('Done!');
  await client.quit();
}

main().catch(console.error);
