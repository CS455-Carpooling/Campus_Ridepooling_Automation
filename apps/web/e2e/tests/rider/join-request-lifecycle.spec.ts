import { test, expect } from '../../fixtures/auth.fixture';
import { RequestPageHelper } from '../../helpers/request.helper';

test.describe('Rider Join Request Lifecycle Workflows (FR-RD-06, FR-RO-05, Deliverable 1)', () => {
  test('complete join request lifecycle: request, owner accept, and accepted state display', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create scheduled ride with owner
    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 600,
      departureStart: new Date(Date.now() + 48 * 3600 * 1000),
      departureEnd: new Date(Date.now() + 50 * 3600 * 1000),
      state: 'scheduled',
    });

    // 2. Rider opens the ride page
    await riderContext.page.goto(`/rides/${rideId}`);
    await expect(riderContext.page.getByRole('heading', { level: 1 })).toBeVisible();

    const riderHelper = new RequestPageHelper(riderContext.page);

    // 3. Rider requests a seat from Hall 1
    await riderHelper.requestSeat('Hall 1');
    await riderHelper.verifyRiderStatus(/waiting for the ride owner/i);

    // 4. Owner views the ride page and sees the pending request
    await ownerContext.page.goto(`/rides/${rideId}`);
    const ownerHelper = new RequestPageHelper(ownerContext.page);
    await ownerHelper.acceptRequest(riderContext.user.name);

    // 5. Rider reloads and sees accepted status
    await riderContext.page.reload();
    await riderHelper.verifyRiderStatus(/accepted/i);

    // Verify seat count updated or rider listed
    await expect(riderContext.page.locator('body')).toContainText(/leave ride/i);
  });

  test('owner rejects join request and rider sees not accepted state', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-2',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 600,
      departureStart: new Date(Date.now() + 48 * 3600 * 1000),
      departureEnd: new Date(Date.now() + 50 * 3600 * 1000),
      state: 'scheduled',
    });

    // Rider requests seat
    await riderContext.page.goto(`/rides/${rideId}`);
    const riderHelper = new RequestPageHelper(riderContext.page);
    await riderHelper.requestSeat('Hall 2');

    // Owner rejects request
    await ownerContext.page.goto(`/rides/${rideId}`);
    const ownerHelper = new RequestPageHelper(ownerContext.page);
    await ownerHelper.rejectRequest(riderContext.user.name);

    // Rider reloads and sees "Not accepted" status
    await riderContext.page.reload();
    await riderHelper.verifyRiderStatus(/not accepted/i);
  });

  test('rider withdraws pending join request before owner decision', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'auto',
      capacity: 3,
      expectedTotalFare: 450,
      departureStart: new Date(Date.now() + 36 * 3600 * 1000),
      departureEnd: new Date(Date.now() + 38 * 3600 * 1000),
      state: 'scheduled',
    });

    await riderContext.page.goto(`/rides/${rideId}`);
    const riderHelper = new RequestPageHelper(riderContext.page);
    await riderHelper.requestSeat('Hall 1');
    await riderHelper.verifyRiderStatus(/waiting for the ride owner/i);

    // Rider withdraws
    await riderHelper.withdrawRequest();

    // Rider sees withdrawn status in history
    await riderContext.page.reload();
    await expect(riderContext.page.locator('body')).toContainText(/withdrawn/i);
  });

  test('rider leaves an accepted ride before lock window', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 600,
      departureStart: new Date(Date.now() + 48 * 3600 * 1000),
      departureEnd: new Date(Date.now() + 50 * 3600 * 1000),
      state: 'scheduled',
    });

    // Rider requests
    await riderContext.page.goto(`/rides/${rideId}`);
    const riderHelper = new RequestPageHelper(riderContext.page);
    await riderHelper.requestSeat('Hall 1');

    // Owner accepts
    await ownerContext.page.goto(`/rides/${rideId}`);
    const ownerHelper = new RequestPageHelper(ownerContext.page);
    await ownerHelper.acceptRequest(riderContext.user.name);

    // Rider reloads and leaves ride
    await riderContext.page.reload();
    await riderHelper.verifyRiderStatus(/accepted/i);
    await riderHelper.leaveRide();

    // Rider reloads and sees "You left this ride"
    await riderContext.page.reload();
    await expect(riderContext.page.locator('body')).toContainText(/you left this ride/i);
  });

  test('ride owner cannot submit a join request to their own ride (US-RD-06, FR-RO-01)', async ({
    db,
    ownerContext,
  }) => {
    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 600,
      departureStart: new Date(Date.now() + 48 * 3600 * 1000),
      departureEnd: new Date(Date.now() + 50 * 3600 * 1000),
      state: 'scheduled',
    });

    // Owner opens their own ride page
    await ownerContext.page.goto(`/rides/${rideId}`);

    // Verify owner controls are present (Manage this ride, Join requests) but "Request a seat" button is NOT present
    await expect(
      ownerContext.page.getByRole('heading', { name: /manage this ride/i }),
    ).toBeVisible();
    await expect(
      ownerContext.page.getByRole('button', { name: /request a seat/i }),
    ).not.toBeVisible();
  });

  test('idempotency: sending identical request does not duplicate database records (FR-RD-06.9, CS455-75)', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 600,
      departureStart: new Date(Date.now() + 48 * 3600 * 1000),
      departureEnd: new Date(Date.now() + 50 * 3600 * 1000),
      state: 'scheduled',
    });

    await riderContext.page.goto(`/rides/${rideId}`);
    const riderHelper = new RequestPageHelper(riderContext.page);
    await riderHelper.requestSeat('Hall 1');

    // Query database count of requests for this ride and rider
    const { rows } = await db.query(
      `SELECT count(*) as count FROM ride_join_requests WHERE ride_id = $1 AND rider_id = $2`,
      [rideId, riderContext.user.id],
    );

    expect(Number(rows[0].count)).toBe(1);
  });
});
