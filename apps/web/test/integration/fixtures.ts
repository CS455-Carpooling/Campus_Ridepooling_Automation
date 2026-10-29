import { POST as createRide } from '@/app/api/rides/route';
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
 * started), keeping the window's length. The same move apps/web/setup.md uses to try a trip
 * without waiting: 30 puts the ride in its lock window, -20 is past the no-show grace period.
 */
export async function moveDeparture(rideId: string, minutesFromNow: number): Promise<void> {
  await pool.query(
    `UPDATE rides
     SET departure_end = now() + make_interval(mins => $2) + (departure_end - departure_start),
         departure_start = now() + make_interval(mins => $2)
     WHERE id = $1`,
    [rideId, minutesFromNow],
  );
}
