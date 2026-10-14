import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isNavigationReload,
  resolveChatbotInitialMessages,
  clearChatbotStorage,
  CHATBOT_STORAGE_PREFIX,
} from './chatbot-session';

describe('Chatbot Session & Storage Lifecycle (FR-RD-05.6)', () => {
  const USER_ID = '33333333-3333-4333-8333-333333333333';
  const STORAGE_KEY = `${CHATBOT_STORAGE_PREFIX}${USER_ID}`;
  const INITIAL_GREETING = { id: 'greeting', text: 'Hello! I am your AI assistant.' };

  // Mock in-memory sessionStorage
  const storageMap = new Map<string, string>();
  const mockSessionStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, val: string) => {
      storageMap.set(key, val);
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
    clear: () => {
      storageMap.clear();
    },
    get length() {
      return storageMap.size;
    },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
  };

  beforeEach(() => {
    storageMap.clear();
    vi.restoreAllMocks();

    // Set up global window and performance mocks
    vi.stubGlobal('window', {
      sessionStorage: mockSessionStorage,
      performance: {
        getEntriesByType: vi.fn().mockReturnValue([]),
      },
    });
  });

  it('preserves conversation content during normal intra-session tab operations', () => {
    const messages = [
      INITIAL_GREETING,
      {
        id: 'msg-1',
        sender: 'user',
        timestamp: new Date().toISOString(),
        text: 'Find rides to Kanpur Central',
      },
    ];
    mockSessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));

    // Regular navigation (not a reload)
    vi.mocked(window.performance.getEntriesByType).mockReturnValue([
      { type: 'navigate' } as PerformanceNavigationTiming,
    ]);

    const initial = resolveChatbotInitialMessages(STORAGE_KEY, INITIAL_GREETING);
    expect(initial).toEqual(messages);
    expect(mockSessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('FR-RD-05.6: discards conversation content and purges storage when the page is reloaded', () => {
    const messages = [
      INITIAL_GREETING,
      {
        id: 'msg-1',
        sender: 'user',
        timestamp: new Date().toISOString(),
        text: 'Confidential conversation before reload',
      },
    ];
    mockSessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));

    // Simulate page reload
    vi.mocked(window.performance.getEntriesByType).mockReturnValue([
      { type: 'reload' } as PerformanceNavigationTiming,
    ]);

    expect(isNavigationReload()).toBe(true);

    const initial = resolveChatbotInitialMessages(STORAGE_KEY, INITIAL_GREETING);

    // Stored conversation must be discarded, resetting to clean INITIAL_GREETING
    expect(initial).toEqual([INITIAL_GREETING]);
    expect(mockSessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('FR-RD-05.6: clears all chatbot conversations from sessionStorage on rider sign-out', () => {
    const user1Key = `${CHATBOT_STORAGE_PREFIX}11111111-1111-4111-8111-111111111111`;
    const user2Key = `${CHATBOT_STORAGE_PREFIX}22222222-2222-4222-8222-222222222222`;
    const unrelatedKey = 'other_app_session_data';

    mockSessionStorage.setItem(user1Key, JSON.stringify([{ id: '1', text: 'Chat User 1' }]));
    mockSessionStorage.setItem(user2Key, JSON.stringify([{ id: '2', text: 'Chat User 2' }]));
    mockSessionStorage.setItem(unrelatedKey, 'should_persist');

    // Execute sign-out cleanup
    clearChatbotStorage();

    // Chatbot session keys must be purged
    expect(mockSessionStorage.getItem(user1Key)).toBeNull();
    expect(mockSessionStorage.getItem(user2Key)).toBeNull();
    // Unrelated keys preserved
    expect(mockSessionStorage.getItem(unrelatedKey)).toBe('should_persist');
  });
});
