import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Brand } from '../models/Brand.ts';

dotenv.config();

async function checkBrands() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    const brands = await Brand.find({});
    console.log('--- ALL BRANDS IN DB ---');
    brands.forEach(b => {
      console.log(`{ name: '${b.name}', logo: '${b.logo}' },`);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error checking brands:', err);
  }
}

checkBrands();
