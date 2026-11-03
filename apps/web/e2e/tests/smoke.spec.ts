import { test, expect } from '@playwright/test';

test.describe('Playwright Infrastructure Smoke Test', () => {
  test('browser engine initializes and executes JavaScript', async ({ page }) => {
    await page.setContent('<html><body><div id="app">Campus Ride-Pooling</div></body></html>');
    const content = await page.textContent('#app');
    expect(content).toBe('Campus Ride-Pooling');
  });
});
