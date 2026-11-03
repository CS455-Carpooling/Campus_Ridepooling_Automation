import { type Page, expect } from '@playwright/test';

export class RequestPageHelper {
  constructor(private page: Page) {}

  async requestSeat(pickupLocationName?: string): Promise<void> {
    if (pickupLocationName) {
      const select = this.page.locator('select#request-pickup');
      if (await select.count() > 0) {
        await select.selectOption({ label: pickupLocationName });
      }
    }
    const requestBtn = this.page.getByRole('button', { name: /request a seat/i });
    await requestBtn.click();
    await expect(this.page.locator('p[role="status"]')).toContainText(/sent to the ride owner/i);
  }

  async withdrawRequest(): Promise<void> {
    const withdrawBtn = this.page.getByRole('button', { name: /withdraw request/i });
    await withdrawBtn.click();
    await expect(this.page.locator('p[role="status"]')).toContainText(/updated/i);
  }

  async leaveRide(): Promise<void> {
    const leaveBtn = this.page.getByRole('button', { name: /leave ride/i });
    await leaveBtn.click();
    await expect(this.page.locator('p[role="status"]')).toContainText(/updated/i);
  }

  async acceptRequest(riderName?: string): Promise<void> {
    const section = this.page.locator('section[aria-labelledby="join-requests-heading"]');
    await expect(section).toBeVisible();

    const acceptBtn = riderName
      ? section.locator('li', { hasText: riderName }).getByRole('button', { name: /^accept$/i })
      : section.getByRole('button', { name: /^accept$/i }).first();

    await acceptBtn.click();
    await expect(this.page.locator('p[role="status"]').first()).toContainText(/updated/i);
  }

  async rejectRequest(riderName?: string): Promise<void> {
    const section = this.page.locator('section[aria-labelledby="join-requests-heading"]');
    await expect(section).toBeVisible();

    const rejectBtn = riderName
      ? section.locator('li', { hasText: riderName }).getByRole('button', { name: /^reject$/i })
      : section.getByRole('button', { name: /^reject$/i }).first();

    await rejectBtn.click();
    await expect(this.page.locator('p[role="status"]').first()).toContainText(/updated/i);
  }

  async reconfirmTerms(): Promise<void> {
    const reconfirmBtn = this.page.getByRole('button', { name: /confirm new terms/i });
    await reconfirmBtn.click();
    await expect(this.page.locator('p[role="status"]')).toContainText(/updated/i);
  }

  async declineTerms(): Promise<void> {
    const declineBtn = this.page.getByRole('button', { name: /decline/i });
    await declineBtn.click();
    await expect(this.page.locator('p[role="status"]')).toContainText(/updated/i);
  }

  async verifyRiderStatus(expectedStatus: RegExp | string): Promise<void> {
    const section = this.page.locator('section[aria-labelledby="your-request-heading"]');
    await expect(section.getByText(expectedStatus).first()).toBeVisible();
  }
}
