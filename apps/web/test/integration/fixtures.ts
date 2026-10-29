import { POST as markArrival } from '@/app/api/rides/[id]/arrivals/route';
import { POST as checkInRoute } from '@/app/api/rides/[id]/check-in/route';
import { PATCH as changeRequest } from '@/app/api/rides/[id]/requests/[requestId]/route';
import { POST as submitRequest } from '@/app/api/rides/[id]/requests/route';
import { POST as createRide } from '@/app/api/rides/route';
import { POST as tripRoute } from '@/app/api/rides/[id]/trip/route';
import { pool } from '@/lib/db';
import { createAccount, createSessionToken, type TestAccount } from '../seed/accounts';
import { callRoute, type Caller } from './http';

export type SignedIn = TestAccount & Caller;

const MINUTE = 60_000;

/** A student who has finished profile setup and is signed in. */
export async function signedInStudent(
  options: Parameters<typeof createAccount>[1] = {},
): Promise<SignedIn> {
  const account = await createAccount(pool, { ...options, role: 'student' });
  return { ...account, token: await createSessionToken(pool, account.id) };
}

/** A signed-in operations admin. */
export async function signedInAdmin(
  options: Parameters<typeof createAccount>[1] = {},
): Promise<SignedIn> {
  const account = await createAccount(pool, { ...options, role: 'admin' });
  return { ...account, token: await createSessionToken(pool, account.id) };
}

/** The body of POST /api/rides: a car to Kanpur Central leaving in three hours, by default. */
export function rideOffer(overrides: Record<string, unknown> = {}, now = new Date()) {
  const start = new Date(now.getTime() + 180 * MINUTE);
  return {
    direction: 'to_hub',
    hubId: 'kanpur-central',
    campusLocationId: 'hall-1',
    vehicleTypeId: 'car',
    departureStart: start.toISOString(),
    departureEnd: new Date(start.getTime() + 60 * MINUTE).toISOString(),
    expectedTotalFare: 600,
    ...overrides,
  };
}

/** Offers a ride through the real API; fails the test unless it is created. */
export async function offerRide(owner: Caller, overrides: Record<string, unknown> = {}) {
  const result = await callRoute(createRide, {
    method: 'POST',
    path: '/api/rides',
    as: owner,
    body: rideOffer(overrides),
  });
  if (result.status !== 201) {
    throw new Error(`Offering a ride failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body.ride as { id: string; ownerId: string; state: string };
}

/**
 * Moves a ride's departure so that it starts `minutesFromNow` from now (negative: already
 * started; fractions for boundaries, such as 60.5), as if the clock had moved on: the window keeps its length, and the departure and
 * pickup times riders agreed to move with it. The same move apps/web/setup.md uses to try a
 * trip without waiting: 30 puts the ride in its lock window, -20 is past the no-show grace
 * period.
 */
export async function moveDeparture(rideId: string, minutesFromNow: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT now() + make_interval(secs => $2::float8 * 60) - departure_start AS shift
       FROM rides WHERE id = $1`,
      [rideId, minutesFromNow],
    );
    const shift = rows[0]?.shift;
    await client.query(
      `UPDATE rides
       SET departure_start = departure_start + $2::interval,
           departure_end = departure_end + $2::interval
       WHERE id = $1`,
      [rideId, shift],
    );
    await client.query(
      `UPDATE ride_join_requests
       SET snapshot_departure_start = snapshot_departure_start + $2::interval,
           snapshot_pickup_at = snapshot_pickup_at + $2::interval,
           accepted_departure_start = accepted_departure_start + $2::interval,
           accepted_pickup_at = accepted_pickup_at + $2::interval,
           current_departure_start = current_departure_start + $2::interval,
           current_pickup_at = current_pickup_at + $2::interval
       WHERE ride_id = $1`,
      [rideId, shift],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Asks for a seat through POST /api/rides/[id]/requests; returns the response to check. */
export async function requestSeat(
  rider: Caller,
  rideId: string,
  options: { pickupLocationId?: string; idempotencyKey?: string } = {},
) {
  return callRoute(submitRequest, {
    method: 'POST',
    path: `/api/rides/${rideId}/requests`,
    params: { id: rideId },
    as: rider,
    body: {
      pickupLocationId: options.pickupLocationId ?? 'hall-2',
      idempotencyKey: options.idempotencyKey ?? crypto.randomUUID(),
    },
  });
}

/** Accept, reject, withdraw, leave, reconfirm or decline through the request route. */
export async function actOnRequest(
  actor: Caller,
  rideId: string,
  requestId: string,
  action: string,
  extra: Record<string, unknown> = {},
) {
  return callRoute(changeRequest, {
    method: 'PATCH',
    path: `/api/rides/${rideId}/requests/${requestId}`,
    params: { id: rideId, requestId },
    as: actor,
    body: { action, ...extra },
  });
}

/** Puts `rider` in the pool: they ask, the owner accepts. Fails the test if either step does. */
export async function joinRide(
  owner: Caller,
  rideId: string,
  rider: Caller,
  pickupLocationId = 'hall-2',
): Promise<string> {
  const requested = await requestSeat(rider, rideId, { pickupLocationId });
  if (requested.status !== 201) {
    throw new Error(`Seat request failed: ${requested.status} ${JSON.stringify(requested.body)}`);
  }
  const requestId = requested.body.request.requestId as string;
  const accepted = await actOnRequest(owner, rideId, requestId, 'accept');
  if (accepted.status !== 200 || accepted.body.result.kind !== 'accepted') {
    throw new Error(`Accepting failed: ${accepted.status} ${JSON.stringify(accepted.body)}`);
  }
  return requestId;
}

/** The ride's seats, owner first then in the order people joined, including those who left. */
export async function seatsOf(rideId: string) {
  const { rows } = await pool.query(
    `SELECT s.id, s.user_id, s.campus_location_id, s.left_at, s.locked_share,
            s.checked_in_at, s.arrived_at, s.no_show_at
     FROM riders s JOIN rides r ON r.id = s.ride_id
     WHERE s.ride_id = $1
     ORDER BY (s.user_id = r.owner_id) DESC, s.joined_at, s.id`,
    [rideId],
  );
  return rows;
}

export async function requestRow(requestId: string) {
  const { rows } = await pool.query('SELECT * FROM ride_join_requests WHERE id = $1', [requestId]);
  return rows[0];
}

/** What `userId` was told, oldest first, as type and title. */
export async function notificationsFor(userId: string) {
  const { rows } = await pool.query(
    `SELECT type, title, related_ride_id FROM notifications
     WHERE user_id = $1 ORDER BY created_at, id`,
    [userId],
  );
  return rows as Array<{ type: string; title: string; related_ride_id: string | null }>;
}

/** The owner moves the trip on: pickup_in_progress, in_transit or completed. */
export async function tripStep(owner: Caller, rideId: string, to: string) {
  return callRoute(tripRoute, { method: 'POST', params: { id: rideId }, as: owner, body: { to } });
}

/** The owner marks a seat arrived, not arrived or a no-show during pickup. */
export async function markSeat(owner: Caller, rideId: string, occupantId: string, status: string) {
  return callRoute(markArrival, {
    method: 'POST',
    params: { id: rideId },
    as: owner,
    body: { occupantId, status },
  });
}

/** A rider says they are at their pickup point. */
export async function checkIn(rider: Caller, rideId: string) {
  return callRoute(checkInRoute, { method: 'POST', params: { id: rideId }, as: rider });
}

/**
 * A ride with `riders` people on it besides the owner, departing `startsIn` minutes from now
 * (30: locked, so pickup can start; -20: the no-show grace period is over).
 */
export async function pooledRide(
  options: { riders?: number; startsIn?: number; fare?: number; vehicleTypeId?: string } = {},
) {
  const owner = await signedInStudent();
  const ride = await offerRide(owner, {
    expectedTotalFare: options.fare ?? 600,
    vehicleTypeId: options.vehicleTypeId ?? 'car',
  });
  const riders: SignedIn[] = [];
  const requestIds: string[] = [];
  for (let i = 0; i < (options.riders ?? 1); i += 1) {
    const rider = await signedInStudent({ campusPlace: `hall-${i + 2}` });
    requestIds.push(await joinRide(owner, ride.id, rider, `hall-${i + 2}`));
    riders.push(rider);
  }
  if (options.startsIn !== undefined) await moveDeparture(ride.id, options.startsIn);
  return { owner, ride, riders, requestIds };
}
