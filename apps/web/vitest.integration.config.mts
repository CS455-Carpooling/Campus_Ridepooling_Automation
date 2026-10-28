import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Integration tests (D3, CS455-110): the real route handlers against a real PostgreSQL database.
// `npm run test:integration`. The database is TEST_DATABASE_URL, from the environment or from
// apps/web/.env.local (see setup.md); global-setup.ts refuses any name not ending in _test.
const local = (file: string) => path.join(import.meta.dirname, file);

function fromEnvLocal(): string | undefined {
  try {
    const content = fs.readFileSync(local('.env.local'), 'utf8');
    return content.match(/^TEST_DATABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
}
process.env.TEST_DATABASE_URL ??= fromEnvLocal();

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': local('src'),
      'server-only': local('test/server-only-mock.ts'),
      // Next.js only answers cookies(), headers() and after() inside its own request handling.
      'next/headers': local('test/integration/next-headers.ts'),
      'next/server': local('test/integration/next-server.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/integration/**/*.int.test.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    setupFiles: ['./test/integration/setup.ts'],
    // One database, emptied before every test: files run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      // No email or Gemini calls from tests; both have offline fallbacks.
      MAIL_SCRIPT_URL: '',
      MAIL_SCRIPT_SECRET: '',
      GEMINI_API_KEY: '',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/app/**/layout.tsx'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: './coverage/integration',
    },
  },
});
