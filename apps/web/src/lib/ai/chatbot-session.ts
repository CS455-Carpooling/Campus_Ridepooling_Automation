/**
 * Chatbot session and storage lifecycle management (FR-RD-05.6).
 * Ensures conversation content is kept strictly in the active tab and
 * discarded upon page reload or rider sign-out.
 */

export const CHATBOT_STORAGE_PREFIX = 'crp_chatbot_session_';

/**
 * Detects whether the current page was loaded via a browser reload.
 * FR-RD-05.6 requires conversation content to be discarded on reload and sign-out.
 */
export function isNavigationReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const navEntries = window.performance?.getEntriesByType?.('navigation');
    if (navEntries && navEntries.length > 0) {
      return (navEntries[0] as PerformanceNavigationTiming).type === 'reload';
    }
    // Fallback for older performance navigation API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window.performance as any)?.navigation?.type === 1;
  } catch {
    return false;
  }
}

/**
 * Resolves the initial chat messages for a session.
 * Discards stored conversation on reload per FR-RD-05.6.
 */
export function resolveChatbotInitialMessages<T>(storageKey: string, initialGreeting: T): T[] {
  if (typeof window === 'undefined') return [initialGreeting];
  try {
    // Discard conversation on reload per FR-RD-05.6
    if (isNavigationReload()) {
      window.sessionStorage.removeItem(storageKey);
      return [initialGreeting];
    }
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [initialGreeting];
}

/**
 * Purges all tab-local chatbot conversation history from sessionStorage on sign-out (FR-RD-05.6).
 */
export function clearChatbotStorage(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(CHATBOT_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        window.sessionStorage.removeItem(k);
      }
    }
  } catch {}
}
