import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { E2ETestDatabase } from '../fixtures/database.fixture';

export interface NotificationHelper {
  insertNotification: (
    userId: string,
    options: {
      type: string;
      title: string;
      body: string;
      relatedRideId?: string | null;
    },
  ) => Promise<string>;
  openNotifications: (page: Page) => Promise<void>;
  expectNotification: (page: Page, title: string | RegExp) => Promise<void>;
  markAsRead: (page: Page, title: string | RegExp) => Promise<void>;
}

export function createNotificationHelper(db: E2ETestDatabase): NotificationHelper {
  return {
    async insertNotification(userId, options) {
      const { rows } = await db.query(
        `INSERT INTO notifications (user_id, type, title, body, related_ride_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [userId, options.type, options.title, options.body, options.relatedRideId || null],
      );
      return rows[0].id as string;
    },

    async openNotifications(page) {
      await page.goto('/notifications');
      await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();
    },

    async expectNotification(page, title) {
      await expect(page.getByRole('article', { name: title })).toBeVisible();
    },

    async markAsRead(page, title) {
      const article = page.getByRole('article', { name: title });
      await expect(article).toBeVisible();
      const markButton = article.getByRole('button', { name: /mark as read/i });
      await markButton.click();
      await expect(markButton).not.toBeVisible();
    },
  };
}
