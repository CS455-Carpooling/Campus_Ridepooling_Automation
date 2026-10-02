import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are off, so unmount rendered components after each test here.
afterEach(() => {
  cleanup();
});
