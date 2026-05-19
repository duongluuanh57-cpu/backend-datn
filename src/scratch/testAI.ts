import dotenv from 'dotenv';
import { buildApp } from '../app.ts';
import { connectDB } from '../config/database.ts';
import { connectRedis } from '../config/redis.ts';

dotenv.config();

async function run() {
  console.log("Connecting database & redis...");
  await connectDB();
  await connectRedis();

  const app = buildApp();
  
  console.log("=== INJECTING AI PRODUCT GENERATION REQUEST ===");
  const response = await app.inject({
    method: 'POST',
    url: '/api/ai/generate-product',
    payload: {
      name: "Bleu de Chanel",
      image: "https://i.ibb.co/LhJhpsKs/Midnight-Rose-copy.webp",
      availableBrands: ["Chanel", "Gucci", "Dior"]
    }
  });

  console.log("Response Status:", response.statusCode);
  console.log("Response Body:", JSON.parse(response.body));
  process.exit(0);
}

run().catch(err => {
  console.error("FATAL ERROR IN TEST SCRIPT:", err);
  process.exit(1);
});
