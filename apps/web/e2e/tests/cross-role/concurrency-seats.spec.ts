import { test, expect } from '../../fixtures/auth.fixture';
import { seedRider } from '../../fixtures/users.fixture';
import { RequestPageHelper } from '../../helpers/request.helper';

test.describe('Concurrency & Seat Contention (FR-RD-04, Table T-1, CS455-75)', () => {
  test('two riders contend for the final seat; owner accepts one and UI disables remaining acceptance', async ({
    db,
    ownerContext,
    riderContext,
    createAuthenticatedContext,
  }) => {
    // 1. Create a ride with capacity = 2 (Owner takes 1 seat, exactly 1 rider seat available)
    const now = new Date();
    const departureStart = new Date(now.getTime() + 4 * 3600 * 1000);
    const departureEnd = new Date(departureStart.getTime() + 3600 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 2,
      expectedTotalFare: 400,
      departureStart,
      departureEnd,
      state: 'scheduled',
    });

    // 2. Rider 1 (Aarav) and Rider 2 (Kavita)
    const rider2 = await seedRider(db, { name: 'Kavita Competitor' });
    const { page: rider2Page } = await createAuthenticatedContext(rider2);

    const rider1Helper = new RequestPageHelper(riderContext.page);
    const rider2Helper = new RequestPageHelper(rider2Page);
    const ownerHelper = new RequestPageHelper(ownerContext.page);

    // 3. Both riders open the ride page and concurrently request the last seat
    await riderContext.page.goto(`/rides/${rideId}`);
    await rider2Page.goto(`/rides/${rideId}`);

    await Promise.all([rider1Helper.requestSeat('Hall 2'), rider2Helper.requestSeat('Hall 3')]);

    await rider1Helper.verifyRiderStatus(/waiting for the ride owner/i);
    await rider2Helper.verifyRiderStatus(/waiting for the ride owner/i);

    // 4. Owner opens the ride page and sees both requests waiting
    await ownerContext.page.goto(`/rides/${rideId}`);
    const requestsSection = ownerContext.page.locator(
      'section[aria-labelledby="join-requests-heading"]',
    );
    await expect(requestsSection).toBeVisible();
    await expect(requestsSection.getByText(riderContext.user.name)).toBeVisible();
    await expect(requestsSection.getByText(rider2.name)).toBeVisible();

    // 5. Owner accepts Rider 1
    await ownerHelper.acceptRequest(riderContext.user.name);

    // 6. After Rider 1 is accepted, ride capacity is full (2/2 seats occupied)
    // The Accept button for Rider 2 must be disabled
    const rider2Item = requestsSection.locator('li', { hasText: rider2.name });
    const rider2AcceptBtn = rider2Item.getByRole('button', { name: /^accept$/i });
    await expect(rider2AcceptBtn).toBeDisabled();

    // 7. Verify database constraints: riders table has exactly 2 rows (owner + rider 1)
    const { rows: occupants } = await db.query(
      `SELECT user_id FROM riders WHERE ride_id = $1 AND left_at IS NULL`,
      [rideId],
    );
    expect(occupants).toHaveLength(2);
    expect(occupants.map((r) => r.user_id)).toContain(ownerContext.user.id);
    expect(occupants.map((r) => r.user_id)).toContain(riderContext.user.id);
    expect(occupants.map((r) => r.user_id)).not.toContain(rider2.id);

    // 8. Rider 1 sees accepted state; Rider 2 does not get a seat
    await riderContext.page.reload();
    await rider1Helper.verifyRiderStatus(/accepted/i);

    await rider2Page.reload();
    await rider2Helper.verifyRiderStatus(/waiting for the ride owner/i);
  });

  test('simultaneous acceptance race at the API level strictly rejects overfilling', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create a ride with capacity = 2 (1 seat available for riders)
    const now = new Date();
    const departureStart = new Date(now.getTime() + 4 * 3600 * 1000);
    const departureEnd = new Date(departureStart.getTime() + 3600 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      capacity: 2,
      departureStart,
      departureEnd,
      state: 'scheduled',
    });

    const rider2 = await seedRider(db, { name: 'Deepak Racer' });

    // Insert pending requests for both riders directly
    const { rows: req1Rows } = await db.query(
      `INSERT INTO ride_join_requests (
         ride_id, rider_id, pickup_location_id, status,
         snapshot_departure_start, snapshot_pickup_at, snapshot_estimated_share,
         current_departure_start, current_pickup_at, current_estimated_share
       ) VALUES ($1, $2, 'hall-2', 'pending', $3, $3, 200, $3, $3, 200)
       RETURNING id`,
      [rideId, riderContext.user.id, departureStart],
    );
    const req1Id = req1Rows[0].id as string;

    const { rows: req2Rows } = await db.query(
      `INSERT INTO ride_join_requests (
         ride_id, rider_id, pickup_location_id, status,
         snapshot_departure_start, snapshot_pickup_at, snapshot_estimated_share,
         current_departure_start, current_pickup_at, current_estimated_share
       ) VALUES ($1, $2, 'hall-3', 'pending', $3, $3, 200, $3, $3, 200)
       RETURNING id`,
      [rideId, rider2.id, departureStart],
    );
    const req2Id = req2Rows[0].id as string;

    // 2. Fire simultaneous PATCH accept requests from the owner browser session
    await ownerContext.page.goto(`/rides/${rideId}`);

    const [status1, status2] = await ownerContext.page.evaluate(
      async ({ rId, r1, r2 }) => {
        const acceptReq = async (reqId: string) => {
          const res = await fetch(`/api/rides/${rId}/requests/${reqId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept' }),
          });
          return res.status;
        };
        return Promise.all([acceptReq(r1), acceptReq(r2)]);
      },
      { rId: rideId, r1: req1Id, r2: req2Id },
    );

    const statuses = [status1, status2];
    // Exactly one should succeed with 200 and one should be rejected with 409 (ride_full)
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    // 3. Database occupants count must be strictly 2 (owner + 1 rider)
    const { rows: occupants } = await db.query(
      `SELECT user_id FROM riders WHERE ride_id = $1 AND left_at IS NULL`,
      [rideId],
    );
    expect(occupants).toHaveLength(2);

    // 4. Verify in browser that the ride details displays 0 free seats
    await ownerContext.page.goto(`/rides/${rideId}`);
    await expect(ownerContext.page.locator('body')).toContainText(/0 free/i);
  });
});
