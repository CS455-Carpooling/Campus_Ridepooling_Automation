import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Ride Management & Trip Progress Lifecycle (FR-RO-04, FR-RO-06, FR-RO-09, Deliverable 1)', () => {
  test('owner locks scheduled ride early and verifies locked state (FR-RO-06.2, FR-RO-06.3)', async ({
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
      departureStart: new Date(Date.now() + 24 * 3600 * 1000),
      departureEnd: new Date(Date.now() + 26 * 3600 * 1000),
      state: 'scheduled',
    });

    await ownerContext.page.goto(`/rides/${rideId}`);

    const lockBtn = ownerContext.page.getByRole('button', { name: /lock ride now/i });
    await expect(lockBtn).toBeVisible();
    await lockBtn.click();

    // Verify confirmation status
    await expect(ownerContext.page.locator('p[role="status"]').first()).toContainText(
      /the ride is locked/i,
    );

    // Verify locked state on page
    await ownerContext.page.reload();
    await expect(ownerContext.page.getByText(/locked since/i)).toBeVisible();
    await expect(
      ownerContext.page.getByRole('button', { name: /lock ride now/i }),
    ).not.toBeVisible();
  });

  test('owner cancels scheduled ride and verifies cancellation status (FR-RO-04.4)', async ({
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
      departureStart: new Date(Date.now() + 36 * 3600 * 1000),
      departureEnd: new Date(Date.now() + 38 * 3600 * 1000),
      state: 'scheduled',
    });

    await ownerContext.page.goto(`/rides/${rideId}`);

    // Click "Cancel ride"
    const cancelBtn = ownerContext.page.getByRole('button', { name: /^cancel ride$/i });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Confirm cancellation
    const confirmCancelBtn = ownerContext.page.getByRole('button', { name: /yes, cancel ride/i });
    await expect(confirmCancelBtn).toBeVisible();
    await confirmCancelBtn.click();

    // Verify cancelled badge in header
    await expect(ownerContext.page.getByText('Cancelled', { exact: true })).toBeVisible();
  });

  test('full trip lifecycle: start pickup, rider check in, start trip, and complete trip (FR-RO-09, FR-RD-10)', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create a ride locked and ready for pickup (departure in 30 minutes)
    const now = new Date();
    const departureStart = new Date(now.getTime() + 30 * 60 * 1000);
    const departureEnd = new Date(now.getTime() + 90 * 60 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 600,
      departureStart,
      departureEnd,
      state: 'scheduled',
      lockedAt: now,
    });

    // 2. Add accepted rider
    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id) VALUES ($1, $2, 'hall-2')`,
      [rideId, riderContext.user.id],
    );
    await db.query(
      `INSERT INTO ride_join_requests (
         ride_id, rider_id, pickup_location_id, status, snapshot_departure_start,
         snapshot_pickup_at, snapshot_estimated_share, current_departure_start,
         current_pickup_at, current_estimated_share, accepted_at
       )
       VALUES ($1, $2, 'hall-2', 'accepted', $3, $3, 300, $3, $3, 300, now())`,
      [rideId, riderContext.user.id, departureStart],
    );

    // 3. Owner opens ride page and starts pickup
    await ownerContext.page.goto(`/rides/${rideId}`);
    const startPickupBtn = ownerContext.page.getByRole('button', { name: /start pickup/i });
    await expect(startPickupBtn).toBeVisible();
    await startPickupBtn.click();

    // Confirm pickup
    const confirmStartPickup = ownerContext.page.getByRole('button', {
      name: /yes, start pickup/i,
    });
    await expect(confirmStartPickup).toBeVisible();
    await confirmStartPickup.click();

    // Verify ride state is now "Pickup in progress"
    await expect(ownerContext.page.getByText('Pickup in progress')).toBeVisible();

    // 4. Rider views live pickup status
    await riderContext.page.goto(`/rides/${rideId}`);
    await expect(riderContext.page.getByText('Pickup in progress')).toBeVisible();

    // 5. Owner marks rider arrived
    await ownerContext.page.goto(`/rides/${rideId}`);
    const arrivedBtn = ownerContext.page.getByRole('button', {
      name: `${riderContext.user.name} arrived`,
    });
    await expect(arrivedBtn).toBeVisible();
    await arrivedBtn.click();
    await expect(
      ownerContext.page.getByRole('button', {
        name: `Undo arrived for ${riderContext.user.name}`,
      }),
    ).toBeVisible();

    // 6. Owner starts the trip
    const startTripBtn = ownerContext.page.getByRole('button', { name: /start the trip/i });
    await expect(startTripBtn).toBeVisible();
    await startTripBtn.click();

    const confirmStartTrip = ownerContext.page.getByRole('button', {
      name: /yes, start the trip/i,
    });
    await expect(confirmStartTrip).toBeVisible();
    await confirmStartTrip.click();

    // Verify in transit state
    await expect(ownerContext.page.getByText('In transit')).toBeVisible();

    // 7. Owner completes the trip
    const completeBtn = ownerContext.page.getByRole('button', { name: /complete the ride/i });
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();

    const confirmComplete = ownerContext.page.getByRole('button', { name: /yes, complete it/i });
    await expect(confirmComplete).toBeVisible();
    await confirmComplete.click();

    // Verify completed state
    await expect(ownerContext.page.getByText('Completed', { exact: true })).toBeVisible();
  });
});
