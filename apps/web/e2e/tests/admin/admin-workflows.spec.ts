import { test, expect } from '../../fixtures/auth.fixture';
import { seedOwner, seedRider } from '../../fixtures/users.fixture';
import { RidePageHelper } from '../../helpers/ride.helper';

test.describe('Admin Workflows, Governance & Account Enforcement (OA-FR-01..07, OA-FR-16..23, SYS-FR-24..26, CS455-50..53)', () => {
  test('admin configures vehicle types and transport hubs (OA-FR-01, OA-FR-02, OA-FR-03, CS455-51)', async ({
    adminContext,
    db,
  }) => {
    const adminPage = adminContext.page;

    // 1. Admin navigates to /admin/configuration
    await adminPage.goto('/admin/configuration');
    await expect(adminPage.getByRole('heading', { name: 'Configuration', exact: true })).toBeVisible();

    // Verify sections for Vehicle types, Hubs and pickup points, Fares
    await expect(adminPage.getByRole('link', { name: /vehicle types/i })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: /hubs and pickup points/i })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: /^fares$/i })).toBeVisible();

    // 2. Open Vehicle types editor
    await adminPage.getByRole('link', { name: /vehicle types/i }).click();
    await expect(adminPage.getByRole('heading', { name: /all vehicle types/i })).toBeVisible();

    // Verify existing seeded vehicles
    await expect(adminPage.getByText('Car', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Auto', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Vikram', { exact: true })).toBeVisible();

    // 3. Add a new vehicle type through the form
    const addSection = adminPage.getByRole('heading', { name: /add a vehicle type/i }).locator('..');
    await addSection.getByLabel('Name').fill('Electric Shuttle');
    await addSection.getByLabel('Capacity').fill('8');

    const addBtn = addSection.getByRole('button', { name: /add vehicle type/i });
    await addBtn.click();

    // Verify confirmation and addition to list
    await expect(adminPage.getByRole('status')).toContainText(/added Electric Shuttle/i);
    await expect(adminPage.getByText('Electric Shuttle', { exact: true })).toBeVisible();
    await expect(adminPage.getByText(/carries 8 people, the owner included/i)).toBeVisible();

    // 4. Verify transport hubs configuration page
    await adminPage.goto('/admin/configuration/hubs');
    await expect(adminPage.getByRole('heading', { name: /transport hubs/i })).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: /campus pickup points/i })).toBeVisible();
    await expect(adminPage.getByText('Kanpur Central', { exact: false })).toBeVisible();

    // Cleanup added vehicle type
    await db.query(`DELETE FROM vehicle_types WHERE id = 'electric-shuttle' OR name = 'Electric Shuttle'`);
  });

  test('admin complaint processing lifecycle from submission to resolution (OA-FR-16, OA-FR-18, OA-FR-20, FR-RD-13, CS455-53)', async ({
    adminContext,
    db,
  }) => {
    // 1. Seed owner, rider, ride, and a complaint
    const owner = await seedOwner(db, { name: 'Reported Owner' });
    const complainant = await seedRider(db, { name: 'Complainant Student' });

    const rideId = await db.createRideRow(owner.id, {
      state: 'completed',
    });

    // Add complainant to riders on this ride
    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (ride_id, user_id) DO NOTHING`,
      [rideId, complainant.id, 'hall-1'],
    );

    const descriptionText = 'Driver was speeding dangerously and disregarded safety guidelines along the highway route.';
    const { rows: compRows } = await db.query(
      `INSERT INTO complaints (
         ride_id, complainant_id, accused_id, category, description, source, status
       )
       VALUES ($1, $2, $3, $4, $5, 'form', 'submitted')
       RETURNING id, reference`,
      [rideId, complainant.id, owner.id, 'safety', descriptionText],
    );
    const complaintId = compRows[0].id as string;
    const complaintRef = compRows[0].reference as string;

    const adminPage = adminContext.page;

    // 2. Admin opens /admin/complaints queue
    await adminPage.goto('/admin/complaints');
    await expect(adminPage.getByRole('heading', { name: /^complaints$/i })).toBeVisible();

    // The submitted complaint must appear in the list with safety highlighted
    const complaintItem = adminPage.getByRole('link', { name: complaintRef });
    await expect(complaintItem).toBeVisible();
    await expect(adminPage.locator('li').filter({ hasText: complaintRef })).toContainText(/safety/i);

    // 3. Admin opens the complaint detail
    await complaintItem.click();
    await expect(adminPage.getByRole('heading', { name: new RegExp(`Complaint ${complaintRef}`, 'i') })).toBeVisible();
    await expect(adminPage.getByText(descriptionText)).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Complainant Student' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Reported Owner' })).toBeVisible();

    // 4. Admin marks complaint as Under Review
    const underReviewBtn = adminPage.getByRole('button', { name: /mark under review/i });
    await expect(underReviewBtn).toBeVisible();
    await underReviewBtn.click();

    // Wait until transition finishes and status label becomes 'Under review'
    await expect(adminPage.getByText('Under review', { exact: true })).toBeVisible();
    await expect(underReviewBtn).not.toBeVisible();
    const { rows: reviewCheck } = await db.query(
      `SELECT status FROM complaints WHERE id = $1`,
      [complaintId],
    );
    expect(reviewCheck[0].status).toBe('under_review');

    // 5. Admin resolves the complaint
    const resolveForm = adminPage.getByRole('form', { name: /resolve this complaint/i });
    await resolveForm.getByRole('radio', { name: /yes, action was taken/i }).click();
    await resolveForm.getByLabel(/note for the record/i).fill('Driver formally warned; caution placed on file.');

    const resolveBtn = resolveForm.getByRole('button', { name: /resolve complaint/i });
    await resolveBtn.click();

    // Outcome and note appear
    await expect(adminPage.locator('header').getByText('Resolved')).toBeVisible();
    await expect(resolveBtn).not.toBeVisible();
    await expect(adminPage.getByText(/action was taken/i)).toBeVisible();
    await expect(adminPage.getByText(/driver formally warned/i)).toBeVisible();

    // 6. Verify in database
    const { rows: resolvedCheck } = await db.query(
      `SELECT status, action_taken, resolution_note, resolved_at FROM complaints WHERE id = $1`,
      [complaintId],
    );
    expect(resolvedCheck[0].status).toBe('resolved');
    expect(resolvedCheck[0].action_taken).toBe(true);
    expect(resolvedCheck[0].resolution_note).toContain('Driver formally warned');
    expect(resolvedCheck[0].resolved_at).not.toBeNull();
  });

  test('admin disciplines rider with suspension and system strictly enforces restrictions (OA-FR-23, SYS-FR-24, SYS-FR-25, CS455-52, CS455-53, FR-RD-01.5)', async ({
    adminContext,
    createAuthenticatedContext,
    db,
  }) => {
    // 1. Seed a rider to be disciplined
    const rider = await seedRider(db, { name: 'Disciplined Rider' });

    const adminPage = adminContext.page;

    // 2. Admin opens rider profile at /admin/riders/[id]
    await adminPage.goto(`/admin/riders/${rider.id}`);
    await expect(adminPage.getByRole('heading', { name: /disciplined rider/i })).toBeVisible();
    await expect(adminPage.getByText(/account status: active/i)).toBeVisible();

    // 3. Suspend account
    const suspendForm = adminPage.getByRole('form', { name: /suspend rider account/i });
    await suspendForm.getByLabel(/reason category/i).selectOption('no_show');
    await suspendForm.getByLabel(/^reason$/i).fill('Repeated failure to arrive at confirmed pickup point.');
    await suspendForm.getByLabel(/indefinite suspension/i).check();

    // Click Review suspension -> Confirm suspension
    const reviewBtn = suspendForm.getByRole('button', { name: /review suspension/i });
    await reviewBtn.click();

    const confirmBtn = suspendForm.getByRole('button', { name: /confirm suspension/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Success confirmation
    await expect(adminPage.getByText(/suspension saved/i)).toBeVisible();
    await expect(adminPage.getByText(/account status: suspended/i)).toBeVisible();

    // 4. Verify database suspension record
    const { rows: suspRows } = await db.query(
      `SELECT id, is_indefinite, reason_category, lifted_at FROM rider_suspensions WHERE user_id = $1`,
      [rider.id],
    );
    expect(suspRows.length).toBe(1);
    expect(suspRows[0].is_indefinite).toBe(true);
    expect(suspRows[0].reason_category).toBe('no_show');
    expect(suspRows[0].lifted_at).toBeNull();

    // 5. Test enforcement: suspended rider cannot offer a ride
    const riderSession = await createAuthenticatedContext(rider);
    const riderPage = riderSession.page;
    const rideHelper = new RidePageHelper(riderPage);

    await rideHelper.gotoCreateRide();
    const now = new Date();
    const depStart = new Date(now.getTime() + 10 * 3600 * 1000).toISOString().slice(0, 16);
    const depEnd = new Date(now.getTime() + 11 * 3600 * 1000).toISOString().slice(0, 16);

    await rideHelper.fillRideForm({
      direction: 'Leaving campus',
      hubName: 'Kanpur Central',
      campusPlaceName: 'Hall 1',
      vehicleName: 'Car',
      departureStart: depStart,
      departureEnd: depEnd,
      expectedFare: 500,
    });
    await rideHelper.submitCreateForm();

    // Form shows suspension refusal error
    await rideHelper.verifyValidationError(/suspended|cannot offer a ride/i);

    // 6. Test enforcement: suspended rider cannot join rides
    // Create an active ride by another user
    const otherOwner = await seedOwner(db, { name: 'Active Ride Host' });
    const targetRideId = await db.createRideRow(otherOwner.id, {
      state: 'scheduled',
    });

    const joinAttempt = await riderPage.evaluate(async (params) => {
      const res = await fetch(`/api/rides/${params.rideId}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          pickupLocationId: 'hall-1',
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      return { status: res.status, body: await res.json() };
    }, { rideId: targetRideId });

    expect(joinAttempt.status).toBe(403);
    expect(joinAttempt.body.error).toMatch(/suspended/i);

    // 7. Admin lifts the suspension (Reactivation)
    await adminPage.reload();
    const reactivateForm = adminPage.getByRole('form', { name: /reactivate rider account/i });
    await expect(reactivateForm).toBeVisible();
    await reactivateForm.getByLabel(/reason for reactivation/i).fill('Disciplinary period concluded and student counselled.');

    const reviewReactivateBtn = reactivateForm.getByRole('button', { name: /review reactivation/i });
    await reviewReactivateBtn.click();

    const confirmReactivateBtn = reactivateForm.getByRole('button', { name: /confirm reactivation/i });
    await expect(confirmReactivateBtn).toBeVisible();
    await confirmReactivateBtn.click();

    await expect(adminPage.getByText(/rider reactivated/i)).toBeVisible();
    await expect(adminPage.getByText(/account status: active/i)).toBeVisible();

    // 8. Verify lifted in database
    const { rows: liftedCheck } = await db.query(
      `SELECT lifted_at, lift_reason FROM rider_suspensions WHERE user_id = $1`,
      [rider.id],
    );
    expect(liftedCheck[0].lifted_at).not.toBeNull();
    expect(liftedCheck[0].lift_reason).toContain('Disciplinary period concluded');
  });
});
