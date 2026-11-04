import { test, expect } from '@playwright/test';

test.describe('Application Startup & Smoke Tests', () => {
  test('landing page loads successfully at base URL', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Verify main header and brand elements
    await expect(page).toHaveTitle(/Campus Ride-Pooling|Campus Ride Pooling/i);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in|log in/i }).first()).toBeVisible();
  });

  test('login page loads with IITK email requirements and security controls', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);

    // Verify authentication form inputs
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.getByRole('button', { name: /log in|sign in/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Verify IITK domain attribute enforcement (FR-RD-01.1)
    await expect(emailInput).toHaveAttribute('placeholder', 'username@iitk.ac.in');
    const pattern = await emailInput.getAttribute('pattern');
    expect(pattern).toContain('@iitk');
  });

  test('registration page loads with institute domain constraint', async ({ page }) => {
    const response = await page.goto('/register');
    expect(response?.status()).toBe(200);

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('placeholder', 'username@iitk.ac.in');
    await expect(page.getByRole('button', { name: /create my account|register/i })).toBeVisible();
  });

  test('terms and privacy policy pages render without application errors', async ({ page }) => {
    const termsRes = await page.goto('/terms');
    expect(termsRes?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /community guidelines/i })).toBeVisible();

    const privacyRes = await page.goto('/privacy');
    expect(privacyRes?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible();
  });
});
