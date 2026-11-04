import { type Page, expect } from '@playwright/test';

export interface CreateRideParams {
  direction: 'Leaving campus' | 'Coming to campus';
  hubName: string;
  campusPlaceName?: string;
  vehicleName: string;
  departureStart: string;
  departureEnd: string;
  expectedFare: number;
}

export interface SearchRideParams {
  direction: 'Leaving campus' | 'Coming to campus';
  hubName: string;
  campusPlaceName?: string;
  departureStart: string;
  departureEnd: string;
  vehicleName?: string;
}

export class RidePageHelper {
  constructor(private page: Page) {}

  async gotoCreateRide(): Promise<void> {
    await this.page.goto('/rides/new');
    await expect(this.page.getByRole('heading', { name: /create a ride/i })).toBeVisible();
  }

  async gotoSearchRides(): Promise<void> {
    await this.page.goto('/rides');
    await expect(this.page.getByRole('heading', { name: /search for a ride/i })).toBeVisible();
  }

  async submitCreateForm(): Promise<void> {
    const submitBtn = this.page.getByRole('button', { name: /^create ride$/i });
    await submitBtn.click();
  }

  async verifyValidationError(messageRegex: RegExp = /please fix/i): Promise<void> {
    const alert = this.page.locator('div[role="alert"]:not(#__next-route-announcer__)');
    await expect(alert).toContainText(messageRegex);
  }

  async fillRideForm(params: CreateRideParams): Promise<void> {
    // 1. Direction radio
    await this.page.getByRole('radio', { name: new RegExp(params.direction, 'i') }).click();

    // 2. Hub radio
    await this.page.getByRole('radio', { name: new RegExp(params.hubName, 'i') }).click();

    // 3. Campus location
    if (params.campusPlaceName) {
      await this.page
        .locator('select[name="campusLocationId"]')
        .selectOption({ label: params.campusPlaceName });
    }

    // 4. Vehicle radio
    await this.page.getByRole('radio', { name: new RegExp(params.vehicleName, 'i') }).click();

    // 5. Departure window
    await this.page.locator('input[name="departureStart"]').fill(params.departureStart);
    await this.page.locator('input[name="departureEnd"]').fill(params.departureEnd);

    // 6. Fare
    await this.page.locator('input[name="expectedTotalFare"]').fill(String(params.expectedFare));
  }

  async submitSearchForm(params: SearchRideParams): Promise<void> {
    // 1. Direction radio
    await this.page.getByRole('radio', { name: new RegExp(params.direction, 'i') }).click();

    // 2. Hub radio
    await this.page.getByRole('radio', { name: new RegExp(params.hubName, 'i') }).click();

    // 3. Campus location
    if (params.campusPlaceName) {
      await this.page
        .locator('select[name="campusLocationId"]')
        .selectOption({ label: params.campusPlaceName });
    }

    // 4. Departure window
    await this.page.locator('input[name="departureStart"]').fill(params.departureStart);
    await this.page.locator('input[name="departureEnd"]').fill(params.departureEnd);

    // 5. Submit
    await this.page.getByRole('button', { name: /search rides/i }).click();
  }
}
