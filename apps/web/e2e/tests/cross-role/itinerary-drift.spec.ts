import { test, expect } from '../../fixtures/auth.fixture';
import { RequestPageHelper } from '../../helpers/request.helper';

test.describe('Itinerary Drift & Reconfirmation Lifecycle (FR-RD-06, S-2, CS455-75)', () => {
  test('material itinerary drift requires rider reconfirmation before owner can accept', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Owner creates a scheduled ride departing in 3 hours
    const now = new Date();
    const departureStart = new Date(now.getTime() + 3 * 3600 * 1000);
    const departureEnd = new Date(departureStart.getTime() + 3600 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 400,
      departureStart,
      departureEnd,
      state: 'scheduled',
    });

    const riderHelper = new RequestPageHelper(riderContext.page);
    const ownerHelper = new RequestPageHelper(ownerContext.page);

    // 2. Rider requests a seat
    await riderContext.page.goto(`/rides/${rideId}`);
    await riderHelper.requestSeat('Hall 2');
    await riderHelper.verifyRiderStatus(/waiting for the ride owner/i);

    // 3. Simulate material itinerary shift (> 10m drift threshold per FR-RD-06)
    await db.query(
      `UPDATE ride_join_requests
       SET status = 'needs_reconfirmation',
           reason_code = 'itinerary_changed',
           current_departure_start = snapshot_departure_start + interval '25 minutes',
           current_pickup_at = snapshot_pickup_at + interval '25 minutes',
           updated_at = now()
       WHERE ride_id = $1 AND rider_id = $2`,
      [rideId, riderContext.user.id],
    );

    // 4. Rider reloads and sees reconfirmation request
    await riderContext.page.reload();
    await riderHelper.verifyRiderStatus(/your confirmation is needed/i);
    await expect(riderContext.page.getByRole('button', { name: /confirm new terms/i })).toBeVisible();
    await expect(riderContext.page.getByRole('button', { name: /decline/i })).toBeVisible();

    // 5. Owner checks ride: cannot accept until rider reconfirms
    await ownerContext.page.goto(`/rides/${rideId}`);
    const requestsSection = ownerContext.page.locator('section[aria-labelledby="join-requests-heading"]');
    await expect(requestsSection).toContainText(/rider must reconfirm before acceptance/i);
    const ownerAcceptBtn = requestsSection.getByRole('button', { name: /^accept$/i });
    await expect(ownerAcceptBtn).toBeDisabled();

    // 6. Rider reconfirms new terms
    await riderHelper.reconfirmTerms();
    await riderHelper.verifyRiderStatus(/waiting for the ride owner/i);

    // 7. Owner reloads: accept button is now enabled, owner accepts
    await ownerContext.page.reload();
    await expect(ownerAcceptBtn).toBeEnabled();
    await ownerHelper.acceptRequest();

    // 8. Rider sees accepted state and occupant seat in pool
    await riderContext.page.reload();
    await riderHelper.verifyRiderStatus(/accepted/i);

    // Verify in database that rider is accepted in riders table
    const { rows: riderRows } = await db.query(
      `SELECT id FROM riders WHERE ride_id = $1 AND user_id = $2`,
      [rideId, riderContext.user.id],
    );
    expect(riderRows).toHaveLength(1);
  });

  test('rider declines drifted terms and request transitions to withdrawn', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Owner creates a ride
    const now = new Date();
    const departureStart = new Date(now.getTime() + 3 * 3600 * 1000);
    const departureEnd = new Date(departureStart.getTime() + 3600 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      departureStart,
      departureEnd,
      state: 'scheduled',
    });

    const riderHelper = new RequestPageHelper(riderContext.page);

    // 2. Rider requests a seat
    await riderContext.page.goto(`/rides/${rideId}`);
    await riderHelper.requestSeat('Hall 2');

    // 3. Simulate material itinerary shift
    await db.query(
      `UPDATE ride_join_requests
       SET status = 'needs_reconfirmation',
           reason_code = 'itinerary_changed',
           current_departure_start = snapshot_departure_start + interval '30 minutes',
           current_pickup_at = snapshot_pickup_at + interval '30 minutes',
           updated_at = now()
       WHERE ride_id = $1 AND rider_id = $2`,
      [rideId, riderContext.user.id],
    );

    // 4. Rider views drifted terms and clicks Decline
    await riderContext.page.reload();
    await riderHelper.verifyRiderStatus(/your confirmation is needed/i);
    await riderHelper.declineTerms();

    // 5. Rider sees request is no longer active
    await riderHelper.verifyRiderStatus(/withdrawn/i);

    // 6. Database record matches withdrawn state with reason rider_declined
    const { rows: requestRows } = await db.query(
      `SELECT status, reason_code FROM ride_join_requests WHERE ride_id = $1 AND rider_id = $2`,
      [rideId, riderContext.user.id],
    );
    expect(requestRows[0].status).toBe('withdrawn');
    expect(requestRows[0].reason_code).toBe('rider_declined');

    // 7. Owner sees no pending requests waiting
    await ownerContext.page.goto(`/rides/${rideId}`);
    const requestsSection = ownerContext.page.locator('section[aria-labelledby="join-requests-heading"]');
    await expect(requestsSection).toContainText(/no requests waiting for your decision/i);
  });
});
