import { GoogleGenAI } from '@google/genai';

const key = process.env.GEMINI_API_KEY?.trim();
if (!key) throw new Error('GEMINI_API_KEY is missing');

// Initialize the SDK client
const ai = new GoogleGenAI({ apiKey: key });

try {
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: 'Reply with exactly GEMINI_OK',
  });

  console.log('Response:', response.text);
} catch (error) {
  console.error('Error:', error.message);
}
