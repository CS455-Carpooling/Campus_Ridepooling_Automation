import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.APP_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sequential execution to prevent test database race conditions
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: '../../test-results/playwright-report',
        open: 'never',
      },
    ],
    [
      'json',
      {
        outputFile: '../../test-results/system-results.json',
      },
    ],
  ],
  outputDir: '../../test-results/artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'node --experimental-strip-types server.mjs',
        url: `${BASE_URL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          PORT: String(PORT),
          APP_URL: BASE_URL,
          NODE_ENV: 'development',
        },
      },
});
