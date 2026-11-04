import { test, expect, injectSessionCookie } from '../../fixtures/auth.fixture';
import { seedRider } from '../../fixtures/users.fixture';

test.describe('Authentication & Role Access Control (E2E)', () => {
  test('unauthenticated user is redirected to login from protected routes', async ({ page }) => {
    // Attempt accessing protected routes directly
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/rides/new');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/complaints');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login input rejects non-IITK email domain (FR-RD-01.1, US-RD-01-AC1)', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.getByRole('button', { name: /log in|sign in/i });

    // Fill non-iitk email
    await emailInput.fill('outsider@gmail.com');
    await passwordInput.fill('password123');

    // Trigger validation
    await submitBtn.click();

    // Check HTML5 validity
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test('unauthorized non-admin cannot access admin panel (SYS-FR-39, SYS-FR-41, US-OA-19)', async ({
    page,
  }) => {
    // Direct navigation to admin portal without admin credentials
    const response = await page.goto('/admin');
    // Either redirected to login or shows unauthorized message
    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
    } else {
      expect(response?.status()).toBeGreaterThanOrEqual(400);
      await expect(page.locator('text=/forbidden|denied|unauthorized|not for you/i')).toBeVisible();
    }
  });

  test('isolated browser contexts maintain separate sessions without cross-contamination', async ({
    browser,
    baseURL,
    db,
  }) => {
    const userA = await seedRider(db, { name: 'Isolated Rider A' });

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      // 1. Inject distinct session cookie into context A only
      await injectSessionCookie(contextA, userA.sessionToken, baseURL || 'http://localhost:3000');

      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      // 2. Assert context A contains the distinct session cookie
      const cookiesA = await contextA.cookies();
      const sessionCookieA = cookiesA.find((c) => c.name === 'crp_session');
      expect(sessionCookieA).toBeDefined();
      expect(sessionCookieA?.value).toBe(userA.sessionToken);

      // 3. Assert context B does NOT contain the session cookie
      const cookiesB = await contextB.cookies();
      const sessionCookieB = cookiesB.find((c) => c.name === 'crp_session');
      expect(sessionCookieB).toBeUndefined();

      // 4. Verify functional isolation on protected routes
      await pageA.goto((baseURL || 'http://localhost:3000') + '/rides');
      await expect(pageA).not.toHaveURL(/\/login/);

      await pageB.goto((baseURL || 'http://localhost:3000') + '/rides');
      await expect(pageB).toHaveURL(/\/login/);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
