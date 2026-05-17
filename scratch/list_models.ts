import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function listModels() {
  try {
    console.log('Listing available models...');
    // We fetch using fetch API because the older client might not expose listModels easily
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    const data = (await response.json()) as any;
    if (data && data.models) {
      console.log('Available Models:');
      data.models.forEach((m: any) => {
        console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods.join(', ')})`);
      });
    } else {
      console.log('No models or error:', data);
    }
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
