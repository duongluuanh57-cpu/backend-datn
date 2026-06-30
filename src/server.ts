import 'dotenv/config';
import { buildApp } from './app.ts';

const app = buildApp();
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`Backend is live at: ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();