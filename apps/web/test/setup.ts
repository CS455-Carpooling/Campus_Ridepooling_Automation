import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// 'server-only' throws when imported outside the Next.js server build; tests
// import server modules directly, so replace it with an empty module.
vi.mock('server-only', () => ({}));

// Vitest globals are off, so unmount rendered components after each test here.
afterEach(() => {
  cleanup();
});
