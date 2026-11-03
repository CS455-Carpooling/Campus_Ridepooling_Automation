import { test, expect } from '../../fixtures/auth.fixture';

test.describe('SOS Safety & Incident Management (FR-RD-15, FR-RO-13, SYS-NFR-07, CS455-64, CS455-65)', () => {
  test('rider raises SOS during in-transit state and incident reference is created', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create a ride in in_transit state
    const now = new Date();
    const departureStart = new Date(now.getTime() - 40 * 60 * 1000);
    const departureEnd = new Date(now.getTime() + 20 * 60 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-1',
      vehicleTypeId: 'car',
      capacity: 4,
      expectedTotalFare: 400,
      departureStart,
      departureEnd,
      state: 'in_transit',
      lockedAt: new Date(now.getTime() - 60 * 60 * 1000),
    });

    // Add rider to riders table
    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id, arrived_at)
       VALUES ($1, $2, 'hall-2', now() - interval '20 minutes')`,
      [rideId, riderContext.user.id],
    );

    // 2. Rider opens ride page during in-transit
    await riderContext.page.goto(`/rides/${rideId}`);

    // SOS emergency button must be visible
    const sosBtn = riderContext.page.getByRole('button', { name: /^sos$/i });
    await expect(sosBtn).toBeVisible();
    await sosBtn.click();

    // Confirmation question appears
    await expect(riderContext.page.getByRole('heading', { name: /send an sos alert\?/i })).toBeVisible();
    const confirmSosBtn = riderContext.page.getByRole('button', { name: /yes, send sos/i });
    await confirmSosBtn.click();

    // 3. Alert is sent and reference is displayed
    await expect(riderContext.page.getByRole('heading', { name: /your sos alert was sent/i })).toBeVisible();
    await expect(riderContext.page.locator('body')).toContainText(/SOS-/);

    // 4. Verify in database: sos_incidents record is created with status open
    const { rows: incidents } = await db.query(
      `SELECT reference, status, trip_state FROM sos_incidents WHERE ride_id = $1 AND raised_by = $2`,
      [rideId, riderContext.user.id],
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].status).toBe('open');
    expect(incidents[0].trip_state).toBe('in_transit');
  });

  test('strict privacy rule: other pool members never see the SOS alert (FR-RD-15.4)', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create in_transit ride with active SOS raised by Rider
    const now = new Date();
    const departureStart = new Date(now.getTime() - 40 * 60 * 1000);
    const departureEnd = new Date(now.getTime() + 20 * 60 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      departureStart,
      departureEnd,
      state: 'in_transit',
      lockedAt: new Date(now.getTime() - 60 * 60 * 1000),
    });

    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id, arrived_at)
       VALUES ($1, $2, 'hall-2', now() - interval '20 minutes')`,
      [rideId, riderContext.user.id],
    );

    // Insert an active SOS incident raised by the rider
    const { rows: incidentRows } = await db.query(
      `INSERT INTO sos_incidents (
         ride_id, raised_by, raised_role, trip_state, context
       ) VALUES ($1, $2, 'rider', 'in_transit', '{}'::jsonb)
       RETURNING reference`,
      [rideId, riderContext.user.id],
    );
    const incidentRef = incidentRows[0].reference as string;

    // 2. Owner opens the ride page
    await ownerContext.page.goto(`/rides/${rideId}`);

    // Owner MUST NOT see the rider's SOS alert or reference
    await expect(ownerContext.page.locator('body')).not.toContainText(/your sos alert was sent/i);
    await expect(ownerContext.page.locator('body')).not.toContainText(incidentRef);

    // 3. Owner visits notifications page: no SOS notifications are delivered to pool members
    await ownerContext.page.goto('/notifications');
    await expect(ownerContext.page.locator('body')).not.toContainText(incidentRef);
    await expect(ownerContext.page.locator('body')).not.toContainText(/sos/i);
  });

  test('admin reviews incident queue, acknowledges alert, and resolves with note (FR-RO-13.2)', async ({
    db,
    ownerContext,
    riderContext,
    adminContext,
  }) => {
    // 1. Create an incident record in the database
    const now = new Date();
    const departureStart = new Date(now.getTime() - 30 * 60 * 1000);
    const departureEnd = new Date(now.getTime() + 30 * 60 * 1000);

    const rideId = await db.createRideRow(ownerContext.user.id, {
      departureStart,
      departureEnd,
      state: 'in_transit',
      lockedAt: new Date(now.getTime() - 45 * 60 * 1000),
    });

    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id, arrived_at)
       VALUES ($1, $2, 'hall-2', now() - interval '20 minutes')`,
      [rideId, riderContext.user.id],
    );

    const { rows: incidentRows } = await db.query(
      `INSERT INTO sos_incidents (
         ride_id, raised_by, raised_role, trip_state, context
       ) VALUES (
         $1, $2, 'rider', 'in_transit',
         json_build_object(
           'ride', json_build_object('title', 'Kanpur Central', 'departureStart', $3::text, 'departureEnd', $4::text, 'vehicle', 'Car'),
           'occupants', json_build_array()
         )
       )
       RETURNING id, reference`,
      [rideId, riderContext.user.id, departureStart.toISOString(), departureEnd.toISOString()],
    );
    const incidentId = incidentRows[0].id as string;
    const incidentRef = incidentRows[0].reference as string;

    // 2. Admin opens /admin/incidents
    await adminContext.page.goto('/admin/incidents');
    await expect(adminContext.page.getByRole('heading', { name: /sos incidents/i })).toBeVisible();

    // Incident is listed
    await expect(adminContext.page.getByRole('link', { name: incidentRef })).toBeVisible();

    // 3. Admin opens the incident detail view
    await adminContext.page.goto(`/admin/incidents/${incidentId}`);
    await expect(adminContext.page.getByRole('heading', { name: incidentRef })).toBeVisible();

    // 4. Admin acknowledges the alert
    const ackBtn = adminContext.page.getByRole('button', { name: /^acknowledge$/i });
    await expect(ackBtn).toBeVisible();
    await ackBtn.click();

    // Acknowledge button disappears after transition completes
    await expect(ackBtn).not.toBeVisible();
    await adminContext.page.reload();
    await expect(adminContext.page.locator('body')).toContainText(/acknowledged/i);

    // 5. Admin enters handling note and closes the alert
    const noteArea = adminContext.page.getByLabel(/how was it handled\?/i);
    await noteArea.fill('Campus security dispatched; rider reached safe area.');
    await expect(adminContext.page.getByText(/\d+ of 1000 characters/i)).not.toHaveText('0 of 1000 characters');

    const closeBtn = adminContext.page.getByRole('button', { name: /close the alert/i });
    await closeBtn.click();

    // Handle section disappears after closed
    await expect(closeBtn).not.toBeVisible();
    await expect(adminContext.page.locator('body')).toContainText(/closed/i);

    // 6. Verify in database: status is closed and close_note is stored
    const { rows: updatedIncident } = await db.query(
      `SELECT status, close_note FROM sos_incidents WHERE id = $1`,
      [incidentId],
    );
    expect(updatedIncident[0].status).toBe('closed');
    expect(updatedIncident[0].close_note).toContain('Campus security dispatched');
  });
});
