export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const GEMINI_REQUEST_TIMEOUT_MS = 20_000;

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}
