import { test as base, type BrowserContext, type Page } from '@playwright/test';
import { seedRider, seedOwner, seedAdmin, type SeededUser } from './users.fixture';
import { createTestDatabaseFixture, type E2ETestDatabase } from './database.fixture';

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

export type UserSession = {
  user: SeededUser;
  context: BrowserContext;
  page: Page;
};

export type AuthTestFixtures = {
  db: E2ETestDatabase;
  riderContext: UserSession;
  ownerContext: UserSession;
  adminContext: UserSession;
  createAuthenticatedContext: (user: SeededUser) => Promise<{ context: BrowserContext; page: Page }>;
};

export const test = base.extend<AuthTestFixtures>({
  db: async ({}, use) => {
    const database = await createTestDatabaseFixture();
    await use(database);
  },

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

  riderContext: async ({ browser, baseURL, db }, use) => {
    const user = await seedRider(db, { name: 'Aarav Rider' });
    const context = await browser.newContext();
    await injectSessionCookie(context, user.sessionToken, baseURL || 'http://localhost:3000');
    const page = await context.newPage();

    await use({ user, context, page });

    await context.close().catch(() => {});
  },

  ownerContext: async ({ browser, baseURL, db }, use) => {
    const user = await seedOwner(db, { name: 'Rohan Owner' });
    const context = await browser.newContext();
    await injectSessionCookie(context, user.sessionToken, baseURL || 'http://localhost:3000');
    const page = await context.newPage();

    await use({ user, context, page });

    await context.close().catch(() => {});
  },

  adminContext: async ({ browser, baseURL, db }, use) => {
    const user = await seedAdmin(db, { name: 'Ops Administrator' });
    const context = await browser.newContext();
    await injectSessionCookie(context, user.sessionToken, baseURL || 'http://localhost:3000');
    const page = await context.newPage();

    await use({ user, context, page });

    await context.close().catch(() => {});
  },
});

export { expect } from '@playwright/test';
