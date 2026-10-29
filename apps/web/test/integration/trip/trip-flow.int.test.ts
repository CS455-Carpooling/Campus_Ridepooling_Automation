import { describe, expect, it } from 'vitest';
import { POST as completeRoute } from '@/app/api/rides/[id]/complete/route';
import { GET as tripStamp } from '@/app/api/rides/[id]/trip/route';
import { pool } from '@/lib/db';
import { callRoute } from '../http';
import {
  checkIn,
  markSeat,
  moveDeparture,
  notificationsFor,
  pooledRide,
  requestRow,
  seatsOf,
  signedInStudent,
  tripStep,
} from '../fixtures';

async function rideRow(rideId: string) {
  const { rows } = await pool.query('SELECT * FROM rides WHERE id = $1', [rideId]);
  return rows[0];
}

async function finalShares(rideId: string) {
  const { rows } = await pool.query(
    `SELECT user_id, role, position, share, payment_status FROM ride_final_shares
     WHERE ride_id = $1 ORDER BY position`,
    [rideId],
  );
  return rows;
}

// Core workflow phases 6 to 8 (CS455-112): pickup, the trip, completion (FR-RO-09, FR-RD-10).
describe('starting pickup', () => {
  it('waits for the lock, and only the owner can start it', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1 });

    const early = await tripStep(owner, ride.id, 'pickup_in_progress');
    expect([early.status, early.body.code]).toEqual([409, 'not_locked']);

    await moveDeparture(ride.id, 30);
    const byRider = await tripStep(riders[0], ride.id, 'pickup_in_progress');
    expect([byRider.status, byRider.body.code]).toEqual([403, 'not_owner']);

    const started = await tripStep(owner, ride.id, 'pickup_in_progress');
    expect(started.status).toBe(200);
    expect(started.body.ride).toMatchObject({ id: ride.id, state: 'pickup_in_progress' });
    expect((await rideRow(ride.id)).pickup_started_at).toBeInstanceOf(Date);
    expect(await notificationsFor(riders[0].id)).toContainEqual({
      type: 'trip_update',
      title: 'Pickup has started',
      related_ride_id: ride.id,
    });

    // Asking again changes nothing and tells nobody twice.
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const notices = (await notificationsFor(riders[0].id)).filter((n) => n.type === 'trip_update');
    expect(notices).toHaveLength(1);
  });

  it('cannot skip pickup, and cannot start once the departure window is over', async () => {
    const { owner, ride } = await pooledRide({ riders: 1, startsIn: 30 });
    const skip = await tripStep(owner, ride.id, 'in_transit');
    expect([skip.status, skip.body.code]).toEqual([409, 'invalid_transition']);
    const finish = await tripStep(owner, ride.id, 'completed');
    expect([finish.status, finish.body.code]).toEqual([409, 'not_started']);

    const late = await pooledRide({ riders: 1, startsIn: -90 });
    const over = await tripStep(late.owner, late.ride.id, 'pickup_in_progress');
    expect([over.status, over.body.code]).toEqual([409, 'window_over']);
  });

  it('rejects an unknown step', async () => {
    const { owner, ride } = await pooledRide({ riders: 1, startsIn: 30 });
    const refused = await tripStep(owner, ride.id, 'teleported');
    expect([refused.status, refused.body.code]).toEqual([400, 'invalid']);
  });
});

describe('during pickup', () => {
  it('lets a rider check in and the owner mark them arrived or undo it', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1, startsIn: 30 });
    const outsider = await signedInStudent();

    const checkedIn = await checkIn(riders[0], ride.id);
    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body.seat.checkedInAt).toEqual(expect.any(String));
    expect((await checkIn(owner, ride.id)).body.code).toBe('owner_seat');
    expect((await checkIn(outsider, ride.id)).status).toBe(404);

    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const [, seat] = await seatsOf(ride.id);

    const arrived = await markSeat(owner, ride.id, seat.id, 'arrived');
    expect(arrived.status).toBe(200);
    expect(arrived.body.seat).toMatchObject({ occupantId: seat.id, arrivedAt: expect.any(String) });
    const undone = await markSeat(owner, ride.id, seat.id, 'not_arrived');
    expect(undone.body.seat.arrivedAt).toBeNull();

    const byRider = await markSeat(riders[0], ride.id, seat.id, 'arrived');
    expect([byRider.status, byRider.body.code]).toEqual([403, 'not_owner']);
    const unknownSeat = await markSeat(owner, ride.id, crypto.randomUUID(), 'arrived');
    expect([unknownSeat.status, unknownSeat.body.code]).toEqual([404, 'seat_not_found']);
  });

  it('refuses a no-show until five minutes after the rider’s pickup time (P-19)', async () => {
    const { owner, ride } = await pooledRide({ riders: 1, startsIn: 30 });
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const [, seat] = await seatsOf(ride.id);

    const early = await markSeat(owner, ride.id, seat.id, 'no_show');
    expect([early.status, early.body.code]).toEqual([409, 'grace_period']);
    expect(new Date(early.body.availableAt).getTime()).toBeGreaterThan(Date.now());
    expect((await seatsOf(ride.id))[1].no_show_at).toBeNull();
  });

  it('records a no-show after the grace period: off the ride, owes nothing, told how to dispute', async () => {
    const { owner, ride, riders, requestIds } = await pooledRide({ riders: 2, startsIn: -20 });
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const [, missing] = await seatsOf(ride.id);

    const marked = await markSeat(owner, ride.id, missing.id, 'no_show');
    expect(marked.status).toBe(200);
    expect(marked.body.seat.noShowAt).toEqual(expect.any(String));
    expect((await requestRow(requestIds[0])).status).toBe('no_show');
    expect(await notificationsFor(riders[0].id)).toContainEqual({
      type: 'no_show_recorded',
      title: 'You were marked as a no-show',
      related_ride_id: ride.id,
    });

    // Marking twice is harmless; marking them arrived now is refused.
    expect((await markSeat(owner, ride.id, missing.id, 'no_show')).status).toBe(200);
    const arrived = await markSeat(owner, ride.id, missing.id, 'arrived');
    expect(arrived.status).toBe(409);
  });
});

describe('the trip and completion (FR-RO-09.4)', () => {
  it('stores the final pool and shares: the no-show’s share is spread over the others', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 2, fare: 900, startsIn: -20 });
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const [, missing] = await seatsOf(ride.id);
    expect((await markSeat(owner, ride.id, missing.id, 'no_show')).status).toBe(200);

    const underway = await tripStep(owner, ride.id, 'in_transit');
    expect(underway.body.ride).toMatchObject({
      state: 'in_transit',
      tripStartedAt: expect.any(String),
    });

    const done = await callRoute(completeRoute, {
      method: 'POST',
      params: { id: ride.id },
      as: owner,
    });
    expect(done.status).toBe(200);
    const row = await rideRow(ride.id);
    expect(row.state).toBe('completed');
    expect(row.completed_at).toBeInstanceOf(Date);

    const shares = await finalShares(ride.id);
    expect(shares).toEqual([
      { user_id: owner.id, role: 'owner', position: 1, share: 450, payment_status: null },
      { user_id: riders[1].id, role: 'rider', position: 2, share: 450, payment_status: 'due' },
    ]);
    expect(shares.reduce((sum, share) => sum + share.share, 0)).toBe(900);
    expect(await notificationsFor(riders[1].id)).toContainEqual({
      type: 'trip_update',
      title: 'Ride completed',
      related_ride_id: ride.id,
    });

    // Completing again is a no-op: the shares are written once.
    expect((await tripStep(owner, ride.id, 'completed')).status).toBe(200);
    expect(await finalShares(ride.id)).toHaveLength(2);
    const reopen = await tripStep(owner, ride.id, 'pickup_in_progress');
    expect([reopen.status, reopen.body.code]).toEqual([409, 'completed']);
  });

  it('counts unmarked riders as on board when the trip starts', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1, fare: 500, startsIn: 30 });
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    expect((await tripStep(owner, ride.id, 'in_transit')).status).toBe(200);
    expect((await seatsOf(ride.id))[1].arrived_at).toBeInstanceOf(Date);
    expect((await tripStep(owner, ride.id, 'completed')).status).toBe(200);
    expect((await finalShares(ride.id)).map((s) => [s.user_id, s.share])).toEqual([
      [owner.id, 250],
      [riders[0].id, 250],
    ]);
  });

  it('answers the live trip stamp to people on the ride only', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1, startsIn: 30 });
    const outsider = await signedInStudent();
    const before = await callRoute(tripStamp, { params: { id: ride.id }, as: riders[0] });
    expect(before.body.state).toBe('scheduled');

    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const after = await callRoute(tripStamp, { params: { id: ride.id }, as: riders[0] });
    expect(after.body.state).toBe('pickup_in_progress');
    expect(after.body.stamp).not.toBe(before.body.stamp);

    expect((await callRoute(tripStamp, { params: { id: ride.id }, as: outsider })).status).toBe(
      404,
    );
  });
});
