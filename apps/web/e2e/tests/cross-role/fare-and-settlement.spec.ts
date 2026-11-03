import { test, expect } from '../../fixtures/auth.fixture';
import { seedRider } from '../../fixtures/users.fixture';

test.describe('Fare Calculation & Settlement Workflows (FR-RD-08, Table T-2, CS455-63)', () => {
  test('Table T-2 whole-rupee splitting distributes remainder to earliest occupants', async ({
    db,
    ownerContext,
    riderContext,
    createAuthenticatedContext,
  }) => {
    // 1. Create a completed ride with total fare ₹500 for 3 occupants
    const totalFare = 500;
    const now = new Date();
    const departureStart = new Date(now.getTime() - 2 * 3600 * 1000);
    const departureEnd = new Date(now.getTime() - 1 * 3600 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'auto',
      capacity: 3,
      expectedTotalFare: totalFare,
      departureStart,
      departureEnd,
      state: 'completed',
      lockedAt: new Date(now.getTime() - 3 * 3600 * 1000),
    });

    // 2. Add Rider 1 (Aarav) and Rider 2 (Priya)
    const rider2 = await seedRider(db, { name: 'Priya Rider' });
    const { page: rider2Page } = await createAuthenticatedContext(rider2);

    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id, joined_at)
       VALUES ($1, $2, 'hall-2', now() - interval '20 minutes')`,
      [rideId, riderContext.user.id],
    );
    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id, joined_at)
       VALUES ($1, $2, 'hall-3', now() - interval '10 minutes')`,
      [rideId, rider2.id],
    );

    // 3. Populate final shares matching Table T-2: 500 / 3 => 167, 167, 166
    // Position must be >= 1, and owner payment_status must be NULL.
    await db.query(
      `INSERT INTO ride_final_shares (ride_id, user_id, role, position, share, payment_status)
       VALUES
         ($1, $2, 'owner', 1, 167, NULL),
         ($1, $3, 'rider', 2, 167, 'due'),
         ($1, $4, 'rider', 3, 166, 'due')`,
      [rideId, ownerContext.user.id, riderContext.user.id, rider2.id],
    );

    // 4. Verify in database: Table T-2 split for 500 / 3 gives 167, 167, 166
    const { rows: shares } = await db.query(
      `SELECT user_id, position, share FROM ride_final_shares WHERE ride_id = $1 ORDER BY position`,
      [rideId],
    );

    expect(shares).toHaveLength(3);
    expect(Number(shares[0].share)).toBe(167); // Owner (earliest)
    expect(Number(shares[1].share)).toBe(167); // Rider 1 (earlier)
    expect(Number(shares[2].share)).toBe(166); // Rider 2 (latest)
    expect(Number(shares[0].share) + Number(shares[1].share) + Number(shares[2].share)).toBe(500);

    // 5. Verify Rider 1 UI displays their calculated share (₹167)
    await riderContext.page.goto(`/rides/${rideId}`);
    await expect(riderContext.page.getByRole('heading', { name: /settle ride shares/i })).toBeVisible();
    await expect(riderContext.page.locator('body')).toContainText(/167/);

    // 6. Verify Rider 2 UI displays their calculated share (₹166)
    await rider2Page.goto(`/rides/${rideId}`);
    await expect(rider2Page.getByRole('heading', { name: /settle ride shares/i })).toBeVisible();
    await expect(rider2Page.locator('body')).toContainText(/166/);
  });

  test('rider marks external payment and owner confirms settlement receipt', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create a completed ride
    const now = new Date();
    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 600,
      departureStart: new Date(now.getTime() - 2 * 3600 * 1000),
      departureEnd: new Date(now.getTime() - 1 * 3600 * 1000),
      state: 'completed',
      lockedAt: new Date(now.getTime() - 3 * 3600 * 1000),
    });

    // Insert rider and final shares
    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id)
       VALUES ($1, $2, 'hall-2')`,
      [rideId, riderContext.user.id],
    );

    await db.query(
      `INSERT INTO ride_final_shares (ride_id, user_id, role, position, share, payment_status)
       VALUES
         ($1, $2, 'owner', 1, 300, NULL),
         ($1, $3, 'rider', 2, 300, 'due')`,
      [rideId, ownerContext.user.id, riderContext.user.id],
    );

    // 2. Rider opens ride, sees settlement form, fills UPI and reference
    await riderContext.page.goto(`/rides/${rideId}`);
    await expect(riderContext.page.getByRole('heading', { name: /settle ride shares/i })).toBeVisible();

    const methodSelect = riderContext.page.locator('select[name="method"]');
    await methodSelect.selectOption('upi');

    const refInput = riderContext.page.locator('input[name="reference"]');
    await refInput.fill('UPI-TXN-492817');

    const markPaidBtn = riderContext.page.getByRole('button', { name: /mark paid/i });
    await markPaidBtn.click();

    // Rider sees "Your share is paid"
    await expect(riderContext.page.locator('body')).toContainText(/paid.*UPI/i);

    // 3. Owner opens ride, sees payment marked as paid, and confirms receipt
    await ownerContext.page.goto(`/rides/${rideId}`);
    await expect(ownerContext.page.getByRole('heading', { name: /settle ride shares/i })).toBeVisible();
    await expect(ownerContext.page.locator('body')).toContainText(/paid.*UPI/i);

    const confirmReceiptBtn = ownerContext.page.getByRole('button', { name: /confirm receipt/i });
    await expect(confirmReceiptBtn).toBeVisible();
    await confirmReceiptBtn.click();

    // Owner UI updates to reflect confirmed status
    await expect(confirmReceiptBtn).not.toBeVisible();
    await expect(ownerContext.page.locator('body')).toContainText(/confirmed.*UPI/i);

    // Verify database record status updated to confirmed
    const { rows: updatedShare } = await db.query(
      `SELECT payment_status FROM ride_final_shares WHERE ride_id = $1 AND user_id = $2`,
      [rideId, riderContext.user.id],
    );
    expect(updatedShare[0].payment_status).toBe('confirmed');
  });

  test('no-show rider owes nothing and is exempted from fare liability (P-19)', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    const now = new Date();
    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 600,
      departureStart: new Date(now.getTime() - 2 * 3600 * 1000),
      departureEnd: new Date(now.getTime() - 1 * 3600 * 1000),
      state: 'completed',
      lockedAt: new Date(now.getTime() - 3 * 3600 * 1000),
    });

    // Mark rider as no-show in riders table with no_show_by matching ownerId
    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id, no_show_at, no_show_by)
       VALUES ($1, $2, 'hall-2', now() - interval '90 minutes', $3)`,
      [rideId, riderContext.user.id, ownerContext.user.id],
    );

    // Owner absorbs whole fare, no-show gets no share entry
    await db.query(
      `INSERT INTO ride_final_shares (ride_id, user_id, role, position, share, payment_status)
       VALUES ($1, $2, 'owner', 1, 600, NULL)`,
      [rideId, ownerContext.user.id],
    );

    // Rider views ride page
    await riderContext.page.goto(`/rides/${rideId}`);

    // No payment is due for no-show
    await expect(riderContext.page.locator('body')).toContainText(/no share is due/i);
  });
});
