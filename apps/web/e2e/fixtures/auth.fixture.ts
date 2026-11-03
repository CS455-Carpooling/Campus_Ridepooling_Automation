import { test as base, type BrowserContext, type Page } from '@playwright/test';
import type { SeededUser } from './users.fixture';

export async function injectSessionCookie(
  context: BrowserContext,
  token: string,
  baseURL: string = 'http://localhost:3000',
): Promise<void> {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: 'crp_session',
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

export async function clearSessionCookie(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

export type AuthTestFixtures = {
  createAuthenticatedContext: (user: SeededUser) => Promise<{ context: BrowserContext; page: Page }>;
};

export const test = base.extend<AuthTestFixtures>({
  createAuthenticatedContext: async ({ browser, baseURL }, use) => {
    const contexts: BrowserContext[] = [];

    const factory = async (user: SeededUser) => {
      const context = await browser.newContext();
      contexts.push(context);
      await injectSessionCookie(context, user.sessionToken, baseURL || 'http://localhost:3000');
      const page = await context.newPage();
      return { context, page };
    };

    await use(factory);

    // Cleanup all created browser contexts
    for (const ctx of contexts) {
      await ctx.close().catch(() => {});
    }
  },
});

export { expect } from '@playwright/test';
