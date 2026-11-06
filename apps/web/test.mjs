import { GoogleGenAI } from '@google/genai';

const key = process.env.GEMINI_API_KEY?.trim();
if (!key) throw new Error('GEMINI_API_KEY is missing');

// Initialize the SDK client
const ai = new GoogleGenAI({ apiKey: key });
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';

try {
  const response = await ai.models.generateContent({
    model,
    contents: 'Reply with exactly GEMINI_OK',
  });

  console.log('Response:', response.text);
} catch (error) {
  console.error('Error:', error.message);
}
