import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ Không tìm thấy GEMINI_API_KEY trong file .env');
    return;
  }

  console.log('--- Đang kiểm tra danh sách Model từ Google AI Studio ---');
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Sử dụng fetch trực tiếp để liệt kê models vì SDK đôi khi giới hạn view
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (data.models) {
      console.log('✅ Các Model khả dụng:');
      data.models.forEach((m: any) => {
        console.log(`- ${m.name} (${m.displayName})`);
      });
    } else {
      console.log('❌ Không lấy được danh sách model:', data);
    }
  } catch (error) {
    console.error('❌ Lỗi kết nối:', error);
  }
}

listModels();
