import { test, expect } from '../../fixtures/auth.fixture';
import { RidePageHelper } from '../../helpers/ride.helper';

function formatLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe('Ride Creation & Discovery Workflows (RO-US-01, US-RD-07, Deliverable 1)', () => {
  test('ride creation form renders all required fields with options for authenticated owner (RO-US-01)', async ({
    ownerContext,
  }) => {
    const { page } = ownerContext;
    const helper = new RidePageHelper(page);

    await helper.gotoCreateRide();

    // Verify form and heading elements
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByRole('heading', { name: /create a ride/i })).toBeVisible();

    // Verify direction choices (Leaving campus / Coming to campus)
    await expect(page.getByRole('radio', { name: /leaving campus/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /coming to campus/i })).toBeVisible();

    // Verify departure window inputs
    await expect(page.locator('input[name="departureStart"]')).toBeVisible();
    await expect(page.locator('input[name="departureEnd"]')).toBeVisible();

    // Verify fare and submit controls
    await expect(page.locator('input[name="expectedTotalFare"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /^create ride$/i })).toBeVisible();
  });

  test('submitting empty ride creation form displays validation errors (RO-US-01 Acceptance)', async ({
    ownerContext,
  }) => {
    const { page } = ownerContext;
    const helper = new RidePageHelper(page);

    await helper.gotoCreateRide();
    await helper.submitCreateForm();

    // Should indicate form errors
    await helper.verifyValidationError(/please fix/i);
  });

  test('owner creates a ride successfully and views the created ride details (RO-US-01, RO-US-02)', async ({
    ownerContext,
  }) => {
    const { page } = ownerContext;
    const helper = new RidePageHelper(page);

    await helper.gotoCreateRide();

    // Choose future dates (tomorrow between 10:00 and 12:00)
    const now = new Date();
    const start = new Date(now.getTime() + 24 * 3600 * 1000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);

    // Fill form
    await helper.fillRideForm({
      direction: 'Leaving campus',
      hubName: 'Kanpur Central',
      campusPlaceName: 'Hall 1',
      vehicleName: 'Car',
      departureStart: formatLocal(start),
      departureEnd: formatLocal(end),
      expectedFare: 600,
    });

    // Submit ride
    await helper.submitCreateForm();

    // Verify success banner and link to view ride
    const successBanner = page.locator('div[role="status"]');
    await expect(successBanner).toBeVisible();
    await expect(successBanner).toContainText(/ride created successfully/i);

    const viewRideLink = page.getByRole('link', { name: /view your ride/i });
    await expect(viewRideLink).toBeVisible();

    // Navigate to ride details
    await viewRideLink.click();
    await page.waitForURL(/\/rides\/[a-f0-9-]+/);

    // Ride details heading and destination verification
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('body')).toContainText(/Kanpur Central/i);
    await expect(page.locator('body')).toContainText(/₹600/i);
  });

  test('ride search form loads with filters and validates inputs (US-RD-07)', async ({
    riderContext,
  }) => {
    const { page } = riderContext;
    const helper = new RidePageHelper(page);

    await helper.gotoSearchRides();

    // Verify search page header
    await expect(page.getByRole('heading', { name: /search for a ride/i })).toBeVisible();

    // Verify search filter inputs exist
    await expect(page.getByRole('radio', { name: /leaving campus/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /search rides/i })).toBeVisible();

    // Submitting without filling direction or required fields shows validation
    await page.getByRole('button', { name: /search rides/i }).click();
    await helper.verifyValidationError(/please fix/i);
  });

  test('rider searches for rides and discovers available offerings (US-RD-07-AC1 to AC4)', async ({
    ownerContext,
    riderContext,
  }) => {
    // 1. Owner creates a ride for 48 hours in the future
    const now = new Date();
    const start = new Date(now.getTime() + 48 * 3600 * 1000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);

    const ownerHelper = new RidePageHelper(ownerContext.page);
    await ownerHelper.gotoCreateRide();
    await ownerHelper.fillRideForm({
      direction: 'Leaving campus',
      hubName: 'Kanpur Central',
      campusPlaceName: 'Hall 1',
      vehicleName: 'Car',
      departureStart: formatLocal(start),
      departureEnd: formatLocal(end),
      expectedFare: 600,
    });
    await ownerHelper.submitCreateForm();
    await expect(ownerContext.page.locator('div[role="status"]')).toBeVisible();

    // 2. Rider searches for the same route and window
    const riderHelper = new RidePageHelper(riderContext.page);
    await riderHelper.gotoSearchRides();

    const searchStart = new Date(start.getTime() - 2 * 3600 * 1000);
    const searchEnd = new Date(end.getTime() + 2 * 3600 * 1000);

    await riderHelper.submitSearchForm({
      direction: 'Leaving campus',
      hubName: 'Kanpur Central',
      campusPlaceName: 'Hall 1',
      departureStart: formatLocal(searchStart),
      departureEnd: formatLocal(searchEnd),
    });

    // Navigates to results
    await riderContext.page.waitForURL(/\/rides\/results/);
    await expect(
      riderContext.page.getByRole('heading', { name: /available rides/i }),
    ).toBeVisible();

    // Result card contains Kanpur Central
    await expect(riderContext.page.locator('body')).toContainText(/Kanpur Central/i);
  });

  test('rider searching non-existent criteria sees empty state (US-RD-07-AC2)', async ({
    riderContext,
  }) => {
    const { page } = riderContext;
    const helper = new RidePageHelper(page);

    await helper.gotoSearchRides();

    // Search for a time far in the future where no rides exist (e.g. 25 days later)
    const now = new Date();
    const searchStart = new Date(now.getTime() + 25 * 24 * 3600 * 1000);
    searchStart.setMinutes(0, 0, 0);
    const searchEnd = new Date(searchStart.getTime() + 2 * 3600 * 1000);

    await helper.submitSearchForm({
      direction: 'Coming to campus',
      hubName: 'Lucknow airport',
      campusPlaceName: 'Hall 1',
      departureStart: formatLocal(searchStart),
      departureEnd: formatLocal(searchEnd),
    });

    await page.waitForURL(/\/rides\/results/);

    await expect(page.getByRole('heading', { name: /no rides found/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(/no open rides match your filters/i);
  });
});
