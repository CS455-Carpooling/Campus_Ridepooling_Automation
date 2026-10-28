import path from 'node:path';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': fileURLToPath(new URL('./test/server-only-mock.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    // Each worker starts its own jsdom; the default (one per CPU core) can exhaust
    // memory on a laptop, and two workers are plenty for this suite.
    maxWorkers: 2,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.ts'],
    // The database tests run on their own: npm run test:integration (vitest.integration.config.mts).
    exclude: [...configDefaults.exclude, 'test/integration/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // layout.tsx loads fonts through next/font, which only runs inside a Next.js
      // build; `npm run build` exercises it.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/app/**/layout.tsx'],
      reporter: ['text', 'html'],
      // NFR-RD-17: at least 80 % coverage; the test run fails below this.
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
