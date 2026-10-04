import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// 'server-only' throws when imported outside the Next.js server build; tests
// import server modules directly, so replace it with an empty module.
vi.mock('server-only', () => ({}));

// next/font only runs inside a Next.js build; in tests each font is a class name.
vi.mock('next/font/google', () => {
  const font = (options: { variable?: string }) => ({
    className: 'font-stub',
    variable: `font-variable${options.variable ?? ''}`,
    style: { fontFamily: 'stub' },
  });
  return { Manrope: font, IBM_Plex_Mono: font };
});

// Vitest globals are off, so unmount rendered components after each test here.
afterEach(() => {
  cleanup();
});
