import { test, expect } from '../../fixtures/auth.fixture';
import { seedRider } from '../../fixtures/users.fixture';
import { createNotificationHelper } from '../../helpers/notification.helper';

test.describe('Realtime Pool Chat & Notifications (FR-RD-09, CS455-46, CS455-60)', () => {
  test('multi-context real-time chat messaging between rider and owner over Socket.IO', async ({
    db,
    ownerContext,
    riderContext,
  }) => {
    // 1. Create a ride locked in advance so chat is available and writable
    const now = new Date();
    const departureStart = new Date(now.getTime() + 2 * 3600 * 1000);
    const departureEnd = new Date(departureStart.getTime() + 3600 * 1000);
    const lockedAt = new Date(now.getTime() - 10 * 60 * 1000);

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
      lockedAt,
    });

    // Add rider to ride
    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id)
       VALUES ($1, $2, 'hall-2')`,
      [rideId, riderContext.user.id],
    );

    // 2. Both users navigate to the ride page
    await ownerContext.page.goto(`/rides/${rideId}`);
    await riderContext.page.goto(`/rides/${rideId}`);

    // Verify both see the Pool chat section
    await expect(ownerContext.page.getByRole('heading', { name: /pool chat/i })).toBeVisible();
    await expect(riderContext.page.getByRole('heading', { name: /pool chat/i })).toBeVisible();

    // 3. Rider sends a message
    const riderMessage = 'Leaving lab now, will reach Hall 1 in 5 mins';
    const riderTextarea = riderContext.page.getByPlaceholder(
      /tell the group about pickup, delays, or route changes/i,
    );
    await riderTextarea.fill(riderMessage);
    await riderContext.page.getByRole('button', { name: /send message/i }).click();

    // Rider sees the message sent
    await expect(riderContext.page.getByText(riderMessage)).toBeVisible();

    // Owner automatically receives the message via Socket.IO without reloading
    await expect(ownerContext.page.getByText(riderMessage)).toBeVisible();

    // 4. Owner sends a response
    const ownerReply = 'Sounds good, vehicle is parked near the main gate';
    const ownerTextarea = ownerContext.page.getByPlaceholder(
      /tell the group about pickup, delays, or route changes/i,
    );
    await ownerTextarea.fill(ownerReply);
    await ownerContext.page.getByRole('button', { name: /send message/i }).click();

    // Owner sees their reply
    await expect(ownerContext.page.getByText(ownerReply)).toBeVisible();

    // Rider receives the owner reply in real time via Socket.IO
    await expect(riderContext.page.getByText(ownerReply)).toBeVisible();
  });

  test('chat room isolation: riders on unrelated rides do not receive each other messages', async ({
    db,
    ownerContext,
    riderContext,
    createAuthenticatedContext,
  }) => {
    const now = new Date();
    const departureStart = new Date(now.getTime() + 2 * 3600 * 1000);
    const departureEnd = new Date(departureStart.getTime() + 3600 * 1000);
    const lockedAt = new Date(now.getTime() - 10 * 60 * 1000);

    // Create Ride 1 (Owner + Rider 1)
    const ride1Id = await db.createRideRow(ownerContext.user.id, {
      departureStart,
      departureEnd,
      lockedAt,
    });
    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id) VALUES ($1, $2, 'hall-1')`,
      [ride1Id, riderContext.user.id],
    );

    // Create Ride 2 (Owner + Rider 2)
    const rider2 = await seedRider(db, { name: 'Vikram Distinct' });
    const { page: rider2Page } = await createAuthenticatedContext(rider2);

    const ride2Id = await db.createRideRow(ownerContext.user.id, {
      departureStart,
      departureEnd,
      lockedAt,
    });
    await db.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id) VALUES ($1, $2, 'hall-3')`,
      [ride2Id, rider2.id],
    );

    // Rider 1 opens Ride 1, Rider 2 opens Ride 2
    await riderContext.page.goto(`/rides/${ride1Id}`);
    await rider2Page.goto(`/rides/${ride2Id}`);

    await expect(riderContext.page.getByRole('heading', { name: /pool chat/i })).toBeVisible();
    await expect(rider2Page.getByRole('heading', { name: /pool chat/i })).toBeVisible();

    // Rider 1 sends confidential ride 1 message
    const secretMsg = 'CONFIDENTIAL_RIDE_1_TOKEN_8832';
    const rider1Textarea = riderContext.page.getByPlaceholder(
      /tell the group about pickup, delays, or route changes/i,
    );
    await rider1Textarea.fill(secretMsg);
    await riderContext.page.getByRole('button', { name: /send message/i }).click();

    await expect(riderContext.page.getByText(secretMsg)).toBeVisible();

    // Ensure Rider 2 does NOT receive the message from Ride 1
    await expect(rider2Page.getByText(secretMsg)).not.toBeVisible();
  });

  test('notifications centre displays real-time notifications and permits marking read', async ({
    db,
    riderContext,
  }) => {
    const notifyHelper = createNotificationHelper(db);

    // Insert deterministic test notification
    const testTitle = 'Ride departure confirmed for 5:30 PM';
    const testBody = 'The vehicle will depart on schedule from Hall 1 circle.';
    await notifyHelper.insertNotification(riderContext.user.id, {
      type: 'ride_update',
      title: testTitle,
      body: testBody,
    });

    // Rider visits notifications page
    await notifyHelper.openNotifications(riderContext.page);

    // Notification is rendered
    await notifyHelper.expectNotification(riderContext.page, testTitle);
    await expect(riderContext.page.getByText(/1 unread notification/i)).toBeVisible();

    // Mark as read
    await notifyHelper.markAsRead(riderContext.page, testTitle);

    // Counter updates to 0 unread
    await expect(riderContext.page.getByText(/0 unread notifications/i)).toBeVisible();

    // Verify in database that read_at is populated
    const { rows } = await db.query(
      `SELECT read_at FROM notifications WHERE user_id = $1 AND title = $2`,
      [riderContext.user.id, testTitle],
    );
    expect(rows[0].read_at).not.toBeNull();
  });
});
