import mongoose from 'mongoose';

export async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('❌ MONGO_URI is not defined in environment variables');
    await mongoose.connect(mongoUri);
    console.log('🍃 MongoDB: Connection established successfully');
  } catch (error) {
    console.error('Kết nối với MongoDB thất bại', error);
    process.exit(1);
  }
}
