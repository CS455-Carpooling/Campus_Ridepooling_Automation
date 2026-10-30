import { describe, expect, it } from 'vitest';
import { POST as lockRide } from '@/app/api/rides/[id]/lock/route';
import { pool } from '@/lib/db';
import { callRoute } from '../http';
import {
  actOnRequest,
  joinRide,
  moveDeparture,
  notificationsFor,
  offerRide,
  requestRow,
  requestSeat,
  seatsOf,
  signedInStudent,
} from '../fixtures';

const MINUTE = 60_000;
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * MINUTE).toISOString();

async function rideRow(rideId: string) {
  const { rows } = await pool.query('SELECT * FROM rides WHERE id = $1', [rideId]);
  return rows[0];
}

const lock = (owner: { token: string }, rideId: string) =>
  callRoute(lockRide, { method: 'POST', params: { id: rideId }, as: owner });

// Core workflow phases 4 and 5 (CS455-111): seats run out, then the ride locks.
describe('the last seat (FR-RO-05.3, NFR-RD-05)', () => {
  it('refuses a request when the ride is full, and an accept that would overfill it', async () => {
    const owner = await signedInStudent();
    const [first, second, late] = await Promise.all([
      signedInStudent(),
      signedInStudent(),
      signedInStudent(),
    ]);
    // An auto seats three: the owner and two riders.
    const ride = await offerRide(owner, { vehicleTypeId: 'auto' });
    await joinRide(owner, ride.id, first);
    // The late rider asks while a seat is still free.
    const waiting = (await requestSeat(late, ride.id)).body.request.requestId;
    await joinRide(owner, ride.id, second);

    const full = await requestSeat(await signedInStudent(), ride.id);
    expect([full.status, full.body.code]).toEqual([409, 'ride_full']);

    const overfill = await actOnRequest(owner, ride.id, waiting, 'accept');
    expect([overfill.status, overfill.body.code]).toEqual([409, 'ride_full']);
    // The request keeps waiting, in case someone leaves.
    expect((await requestRow(waiting)).status).toBe('pending');
    expect((await seatsOf(ride.id)).filter((seat) => seat.left_at === null)).toHaveLength(3);
  });

  it('withdraws a rider’s other request within two hours once they get a seat (P-08)', async () => {
    const [ownerA, ownerB, rider] = await Promise.all([
      signedInStudent(),
      signedInStudent(),
      signedInStudent(),
    ]);
    const rideA = await offerRide(ownerA, {
      departureStart: inMinutes(180),
      departureEnd: inMinutes(200),
    });
    const rideB = await offerRide(ownerB, {
      departureStart: inMinutes(240),
      departureEnd: inMinutes(260),
    });
    const onB = (await requestSeat(rider, rideB.id)).body.request.requestId;
    await joinRide(ownerA, rideA.id, rider);

    // B leaves an hour after A: the seat on A withdraws the request on B, and B's owner is told.
    expect(await requestRow(onB)).toMatchObject({
      status: 'withdrawn',
      reason_code: 'conflicting_ride_accepted',
    });
    expect((await notificationsFor(ownerB.id)).length).toBeGreaterThanOrEqual(2);

    const decided = await actOnRequest(ownerB, rideB.id, onB, 'accept');
    expect([decided.status, decided.body.code]).toEqual([409, 'request_not_active']);
    expect(await seatsOf(rideB.id)).toHaveLength(1);

    // Nor can the rider ask for B again while they hold the seat on A.
    const again = await requestSeat(rider, rideB.id);
    expect([again.status, again.body.code]).toEqual([409, 'departure_conflict']);
  });
});

describe('locking the ride (FR-RO-07, P-06)', () => {
  it('fixes every share when the owner locks early, owner first, and closes waiting requests', async () => {
    const owner = await signedInStudent();
    const [first, second, waiter] = await Promise.all([
      signedInStudent(),
      signedInStudent(),
      signedInStudent(),
    ]);
    const ride = await offerRide(owner, { expectedTotalFare: 1000 });
    const firstRequest = await joinRide(owner, ride.id, first);
    await joinRide(owner, ride.id, second);
    const waiting = (await requestSeat(waiter, ride.id)).body.request.requestId;

    const locked = await lock(owner, ride.id);
    expect(locked.status).toBe(200);
    expect(locked.body).toEqual({ rideId: ride.id, locked: true });

    expect((await rideRow(ride.id)).locked_at).toBeInstanceOf(Date);
    // 1000 among three: the extra rupee goes to the first seat, the owner's.
    expect((await seatsOf(ride.id)).map((seat) => seat.locked_share)).toEqual([334, 333, 333]);
    expect((await requestRow(firstRequest)).locked_share).toBe(333);
    expect((await requestRow(waiting)).status).toBe('expired');
    for (const person of [owner, first, second]) {
      expect((await notificationsFor(person.id)).map((n) => n.title)).toContain('Ride locked');
    }

    const again = await lock(owner, ride.id);
    expect([again.status, again.body.code]).toEqual([409, 'ride_locked']);
    const late = await requestSeat(await signedInStudent(), ride.id);
    expect([late.status, late.body.code]).toEqual([409, 'ride_locked']);
  });

  it('lets only the owner lock', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);
    await joinRide(owner, ride.id, rider);

    const refused = await lock(rider, ride.id);
    expect([refused.status, refused.body.code]).toEqual([403, 'not_owner']);
    expect((await rideRow(ride.id)).locked_at).toBeNull();
  });

  it('locks by itself an hour before departure, on the next request', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner, { expectedTotalFare: 500 });
    await joinRide(owner, ride.id, rider);
    await moveDeparture(ride.id, 59);

    const refused = await requestSeat(await signedInStudent(), ride.id);
    expect([refused.status, refused.body.code]).toEqual([409, 'ride_locked']);
    // The refusal still saves the lock and the shares (the route commits a ride_locked result).
    expect((await rideRow(ride.id)).locked_at).toBeInstanceOf(Date);
    expect((await seatsOf(ride.id)).map((seat) => seat.locked_share)).toEqual([250, 250]);
  });
});

describe('leaving after lock (FR-RD-07.2, P-10)', () => {
  it('asks the rider to confirm, then keeps their locked share payable', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner, { expectedTotalFare: 600 });
    const requestId = await joinRide(owner, ride.id, rider);
    expect((await lock(owner, ride.id)).status).toBe(200);

    const unconfirmed = await actOnRequest(rider, ride.id, requestId, 'leave');
    expect([unconfirmed.status, unconfirmed.body.code]).toEqual([
      409,
      'late_confirmation_required',
    ]);
    expect((await requestRow(requestId)).status).toBe('accepted');

    const confirmed = await actOnRequest(rider, ride.id, requestId, 'leave', {
      confirmLate: true,
    });
    expect(confirmed.body.result).toEqual({
      kind: 'left',
      requestId,
      lateCancellation: true,
      lockedShare: 300,
    });
    expect(await requestRow(requestId)).toMatchObject({
      status: 'left',
      reason_code: 'late_cancellation',
      late_cancellation: true,
      locked_share: 300,
    });
    const [, seat] = await seatsOf(ride.id);
    expect(seat).toMatchObject({ locked_share: 300 });
    expect(seat.left_at).toBeInstanceOf(Date);
    expect((await notificationsFor(owner.id)).map((n) => n.title)).toContain(
      'A rider left the ride',
    );
  });

  it('refuses a malformed confirmation flag', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);
    const requestId = await joinRide(owner, ride.id, rider);

    const refused = await actOnRequest(rider, ride.id, requestId, 'leave', { confirmLate: 'yes' });
    expect([refused.status, refused.body.code]).toEqual([400, 'invalid_confirmation']);
  });
});
