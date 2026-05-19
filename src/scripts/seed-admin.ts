import * as dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.ts';

async function seedAdmin() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI is not defined in environment variables');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('🍃 Connected to MongoDB');

    const email = 'duongluuanh57@gmail.com';
    const username = 'duongluuanh57';
    const password = '123456';

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`⚠️ User with email ${email} already exists.`);
      // Update its role to ADMIN and password
      const passwordHash = await bcrypt.hash(password, 10);
      existingUser.role = 'ADMIN';
      existingUser.username = username;
      existingUser.passwordHash = passwordHash;
      existingUser.memberTier = 'ELITE MEMBER';
      await existingUser.save();
      console.log(`✅ Updated existing user to ADMIN with password '123456' and ELITE MEMBER tier`);
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      const newAdmin = new User({
        username,
        email,
        passwordHash,
        role: 'ADMIN',
        memberTier: 'ELITE MEMBER',
        tenantId: 'default',
        twoFactorEnabled: false
      });
      await newAdmin.save();
      console.log(`✅ Successfully seeded new ADMIN user: ${email} with password '123456' and ELITE MEMBER tier`);
    }
  } catch (error) {
    console.error('❌ Seed Admin Failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🍃 Disconnected from MongoDB');
    process.exit(0);
  }
}

seedAdmin();
