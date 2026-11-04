import { test, expect } from '../../fixtures/auth.fixture';
import { RequestPageHelper } from '../../helpers/request.helper';

test.describe('Time Boundaries, Lock Windows & Cancellation Liability (FR-RO-06.2, FR-RO-06.3, FR-RD-07, P-19, CS455-63)', () => {
  test('lock boundary: ride locks 1 hour before departure and rejects new join requests (FR-RO-06.2, FR-RO-06.3)', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create a ride departing in 40 minutes (past the 60-minute auto-lock threshold)
    const now = new Date();
    const departureStart = new Date(now.getTime() + 40 * 60 * 1000);
    const departureEnd = new Date(departureStart.getTime() + 30 * 60 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      departureStart,
      departureEnd,
      state: 'scheduled',
    });

    // 2. Rider visits the ride page
    await riderContext.page.goto(`/rides/${rideId}`);

    // Join request button must NOT be available because the ride is past lock time
    const requestBtn = riderContext.page.getByRole('button', { name: /request a seat/i });
    await expect(requestBtn).not.toBeVisible();

    // 3. Directly attempting to submit a join request through the API returns 409 ride_locked
    const response = await riderContext.page.evaluate(
      async ({ rId }) => {
        const res = await fetch(`/api/rides/${rId}/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickupLocationId: 'hall-2',
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        return { status: res.status, body: await res.json() };
      },
      { rId: rideId },
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ride_locked');
  });

  test('leaving after lock imposes late-cancellation liability with locked share payable', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create scheduled ride departing in 3 hours
    const now = new Date();
    const departureStart = new Date(now.getTime() + 3 * 3600 * 1000);
    const departureEnd = new Date(departureStart.getTime() + 3600 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      departureStart,
      departureEnd,
      expectedTotalFare: 600,
      state: 'scheduled',
    });

    const riderHelper = new RequestPageHelper(riderContext.page);
    const ownerHelper = new RequestPageHelper(ownerContext.page);

    // 2. Rider requests seat and owner accepts
    await riderContext.page.goto(`/rides/${rideId}`);
    await riderHelper.requestSeat('Hall 2');

    await ownerContext.page.goto(`/rides/${rideId}`);
    await ownerHelper.acceptRequest();

    // 3. Ride locks now (early lock by owner or time elapsed)
    await db.query(`UPDATE rides SET locked_at = now() WHERE id = $1`, [rideId]);
    // Populate locked shares on riders table (300 each for 2 occupants of 600 fare)
    await db.query(`UPDATE riders SET locked_share = 300 WHERE ride_id = $1`, [rideId]);

    // 4. Rider views ride and clicks Leave ride
    await riderContext.page.goto(`/rides/${rideId}`);
    const leaveBtn = riderContext.page.getByRole('button', { name: /leave ride/i });
    await expect(leaveBtn).toBeVisible();

    // Handle confirmation dialog regarding locked share liability
    riderContext.page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await leaveBtn.click();

    // After leaving a locked ride, the rider no longer has an active seat on the locked ride
    // and the page updates to reflect that they are no longer an active participant
    await expect(leaveBtn).not.toBeVisible();
    await expect(riderContext.page.locator('body')).toContainText(/ride not found|your rides/i);

    // 5. Verify database records: late_cancellation = TRUE and locked_share preserved
    const { rows: requestRows } = await db.query(
      `SELECT status, reason_code, late_cancellation, locked_share
       FROM ride_join_requests
       WHERE ride_id = $1 AND rider_id = $2`,
      [rideId, riderContext.user.id],
    );
    expect(requestRows[0].status).toBe('left');
    expect(requestRows[0].late_cancellation).toBe(true);
    expect(requestRows[0].locked_share).toBe(300);
  });

  test('no-show 5-minute grace period enforces wait time before owner can mark rider no-show (P-19)', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create a ride in pickup_in_progress
    const now = new Date();
    const departureStart = new Date(now.getTime() - 20 * 60 * 1000);
    const departureEnd = new Date(now.getTime() + 40 * 60 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      departureStart,
      departureEnd,
      state: 'pickup_in_progress',
      lockedAt: new Date(now.getTime() - 40 * 60 * 1000),
    });

    // Add rider to riders table
    const { rows: riderSeat } = await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id, joined_at)
       VALUES ($1, $2, 'hall-2', now() - interval '30 minutes')
       RETURNING id`,
      [rideId, riderContext.user.id],
    );
    const occupantId = riderSeat[0].id as string;

    // Add accepted request with pickup time set to 2 minutes ago (grace period ends in 3 minutes)
    await db.query(
      `INSERT INTO ride_join_requests (
         ride_id, rider_id, pickup_location_id, status,
         snapshot_departure_start, snapshot_pickup_at, snapshot_estimated_share,
         accepted_pickup_at, current_pickup_at,
         current_departure_start, current_estimated_share, accepted_at
       ) VALUES (
         $1, $2, 'hall-2', 'accepted',
         $3, now() - interval '2 minutes', 200,
         now() - interval '2 minutes', now() - interval '2 minutes',
         $3, 200, now() - interval '30 minutes'
       )`,
      [rideId, riderContext.user.id, departureStart],
    );

    // 2. Owner opens the ride page
    await ownerContext.page.goto(`/rides/${rideId}`);

    // Verify No-show grace countdown text is displayed, and No-show action button is NOT yet open
    await expect(ownerContext.page.getByText(/no-show from/i)).toBeVisible();
    await expect(
      ownerContext.page.getByRole('button', { name: /is a no-show/i }),
    ).not.toBeVisible();

    // Direct API attempt to record no-show fails with grace_period
    const graceAttempt = await ownerContext.page.evaluate(
      async ({ rId, occId }) => {
        const res = await fetch(`/api/rides/${rId}/arrivals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ occupantId: occId, status: 'no_show' }),
        });
        return { status: res.status, body: await res.json() };
      },
      { rId: rideId, occId: occupantId },
    );

    expect(graceAttempt.status).toBe(409);
    expect(graceAttempt.body.code).toBe('grace_period');

    // 3. Move agreed pickup time back so grace period (+5m) has elapsed
    await db.query(
      `UPDATE ride_join_requests
       SET accepted_pickup_at = now() - interval '10 minutes',
           current_pickup_at = now() - interval '10 minutes'
       WHERE ride_id = $1 AND rider_id = $2`,
      [rideId, riderContext.user.id],
    );

    // 4. Owner reloads: No-show button is now open
    await ownerContext.page.reload();
    const noShowBtn = ownerContext.page.getByRole('button', { name: /is a no-show/i });
    await expect(noShowBtn).toBeVisible();
    await noShowBtn.click();

    // Confirmation question appears
    const confirmNoShowBtn = ownerContext.page.getByRole('button', {
      name: /yes, mark as a no-show/i,
    });
    await expect(confirmNoShowBtn).toBeVisible();
    await confirmNoShowBtn.click();

    // The modal closes after server confirmation
    await expect(confirmNoShowBtn).not.toBeVisible();

    // 5. Database verify: riders.no_show_at and no_show_by are populated (polled for network completion)
    await expect
      .poll(async () => {
        const { rows } = await db.query(`SELECT no_show_at FROM riders WHERE id = $1`, [
          occupantId,
        ]);
        return rows[0]?.no_show_at;
      })
      .not.toBeNull();

    const { rows: riderRow } = await db.query(
      `SELECT no_show_at, no_show_by FROM riders WHERE id = $1`,
      [occupantId],
    );
    expect(riderRow[0].no_show_by).toBe(ownerContext.user.id);
  });
});
