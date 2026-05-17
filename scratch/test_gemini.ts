import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function test() {
  try {
    console.log('Testing gemini-3.1-flash-live-preview...');
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-live-preview' });
    const result = await model.generateContent('Hello');
    console.log('Success! Response:', result.response.text());
  } catch (error: any) {
    console.error('FAILED! Error details:', error);
  }
}

test();
