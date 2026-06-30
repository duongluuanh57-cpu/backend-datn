import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

let _gemini: ChatGoogleGenerativeAI | null = null;

/** Get or initialize the Gemini client singleton */
export function getGeminiClient(): ChatGoogleGenerativeAI {
  if (_gemini) return _gemini;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key') {
    throw new Error(
      '❌ GEMINI_API_KEY is not configured for AgentService. ' +
      'Please set a valid GEMINI_API_KEY in your environment variables.'
    );
  }
  if (apiKey.length < 20) {
    throw new Error(
      '❌ GEMINI_API_KEY appears to be invalid (too short) for AgentService. ' +
      'Please check your API key configuration.'
    );
  }

  _gemini = new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-3.1-flash-lite",
  });
  console.log('✅ [AgentService] LangGraph Gemini client initialized successfully');
  return _gemini;
}