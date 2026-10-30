import { describe, expect, it } from 'vitest';
import { PATCH as manageRide } from '@/app/api/rides/[id]/route';
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
  signedInStudent,
} from '../fixtures';

const MINUTE = 60_000;

const manage = (owner: { token: string }, rideId: string, body: Record<string, unknown>) =>
  callRoute(manageRide, { method: 'PATCH', params: { id: rideId }, as: owner, body });

async function rideRow(rideId: string) {
  const { rows } = await pool.query('SELECT * FROM rides WHERE id = $1', [rideId]);
  return rows[0];
}

// Core workflow (CS455-111): the owner changes or cancels a ride people have joined.
describe('cancelling a ride (FR-RO-04.2)', () => {
  it('cancels every request and seat claim and tells each rider they owe nothing', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const waiter = await signedInStudent();
    const ride = await offerRide(owner);
    const accepted = await joinRide(owner, ride.id, rider);
    const waiting = (await requestSeat(waiter, ride.id)).body.request.requestId;
    // Locked rides may still be cancelled until their window ends.
    await moveDeparture(ride.id, 30);

    const cancelled = await manage(owner, ride.id, { action: 'cancel' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toEqual({ ride: { id: ride.id, state: 'cancelled' } });

    const row = await rideRow(ride.id);
    expect(row.state).toBe('cancelled');
    expect(row.cancelled_at).toBeInstanceOf(Date);
    for (const requestId of [accepted, waiting]) {
      expect(await requestRow(requestId)).toMatchObject({
        status: 'ride_cancelled',
        reason_code: 'owner_cancelled',
        locked_share: null,
      });
    }
    const shares = await pool.query(
      'SELECT count(*)::int AS n FROM riders WHERE ride_id = $1 AND locked_share IS NOT NULL',
      [ride.id],
    );
    expect(shares.rows[0].n).toBe(0);
    for (const person of [rider, waiter]) {
      expect((await notificationsFor(person.id)).map((n) => n.title)).toContain('Ride cancelled');
    }

    const again = await manage(owner, ride.id, { action: 'cancel' });
    expect([again.status, again.body.code]).toEqual([409, 'ride_closed']);
  });

  it('refuses anyone but the owner, and a ride whose window is over', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);
    await joinRide(owner, ride.id, rider);

    const notOwner = await manage(rider, ride.id, { action: 'cancel' });
    expect([notOwner.status, notOwner.body.code]).toEqual([403, 'not_owner']);

    await moveDeparture(ride.id, -90);
    const over = await manage(owner, ride.id, { action: 'cancel' });
    expect([over.status, over.body.code]).toEqual([409, 'window_over']);
    expect((await rideRow(ride.id)).state).toBe('scheduled');
  });
});

describe('editing a ride (FR-RO-04.1)', () => {
  it('asks the owner to confirm a change that affects accepted riders, then tells them', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner, { expectedTotalFare: 600 });
    await joinRide(owner, ride.id, rider);

    const unconfirmed = await manage(owner, ride.id, { action: 'edit', expectedTotalFare: 800 });
    expect([unconfirmed.status, unconfirmed.body.code]).toEqual([409, 'confirmation_required']);
    expect((await rideRow(ride.id)).expected_total_fare).toBe(600);

    const confirmed = await manage(owner, ride.id, {
      action: 'edit',
      expectedTotalFare: 800,
      confirmAffectedRiders: true,
    });
    expect(confirmed.status).toBe(200);
    expect((await rideRow(ride.id)).expected_total_fare).toBe(800);
    const told = await notificationsFor(rider.id);
    expect(told.map((n) => n.title)).toContain('Ride details changed');
    // 300 became 400.
    expect(told.map((n) => n.type)).toContain('ride_share_update');
  });

  it('sends a waiting request back to the rider when the departure moves more than 10 minutes', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);
    const requestId = (await requestSeat(rider, ride.id)).body.request.requestId;
    const start = new Date((await rideRow(ride.id)).departure_start);

    const moved = await manage(owner, ride.id, {
      action: 'edit',
      departureStart: new Date(start.getTime() + 30 * MINUTE).toISOString(),
      departureEnd: new Date(start.getTime() + 90 * MINUTE).toISOString(),
    });
    expect(moved.status).toBe(200);
    expect((await requestRow(requestId)).status).toBe('needs_reconfirmation');

    const early = await actOnRequest(owner, ride.id, requestId, 'accept');
    expect([early.status, early.body.code]).toEqual([409, 'request_not_pending']);

    const reconfirmed = await actOnRequest(rider, ride.id, requestId, 'reconfirm');
    expect(reconfirmed.body.result.kind).toBe('reconfirmed');
    const request = await requestRow(requestId);
    expect(request.status).toBe('pending');
    expect(new Date(request.snapshot_departure_start).getTime()).toBe(
      start.getTime() + 30 * MINUTE,
    );
    expect((await actOnRequest(owner, ride.id, requestId, 'accept')).body.result.kind).toBe(
      'accepted',
    );
  });

  it('refuses edits that break the ride’s rules', async () => {
    const owner = await signedInStudent();
    const [a, b] = await Promise.all([signedInStudent(), signedInStudent()]);
    const ride = await offerRide(owner);
    await joinRide(owner, ride.id, a);
    await joinRide(owner, ride.id, b);
    const start = new Date((await rideRow(ride.id)).departure_start).getTime();

    const tooSmall = await manage(owner, ride.id, {
      action: 'edit',
      capacity: 2,
      confirmAffectedRiders: true,
    });
    expect([tooSmall.status, tooSmall.body.code]).toEqual([409, 'ride_full']);

    const tooBig = await manage(owner, ride.id, {
      action: 'edit',
      capacity: 9,
      confirmAffectedRiders: true,
    });
    expect([tooBig.status, tooBig.body.code]).toEqual([409, 'ride_full']);

    const backwards = await manage(owner, ride.id, {
      action: 'edit',
      departureEnd: new Date(start - MINUTE).toISOString(),
    });
    expect([backwards.status, backwards.body.code]).toEqual([400, 'invalid_departure']);

    const notAHub = await manage(owner, ride.id, {
      action: 'edit',
      hubId: 'hall-3',
      confirmAffectedRiders: true,
    });
    expect([notAHub.status, notAHub.body.code]).toEqual([400, 'invalid_pickup']);

    const nonsense = await manage(owner, ride.id, { action: 'repaint' });
    expect([nonsense.status, nonsense.body.code]).toEqual([400, 'invalid_action']);

    await moveDeparture(ride.id, 30);
    const locked = await manage(owner, ride.id, { action: 'edit', expectedTotalFare: 700 });
    expect([locked.status, locked.body.code]).toEqual([409, 'ride_locked']);

    const row = await rideRow(ride.id);
    expect([row.capacity_snapshot, row.hub_id, row.expected_total_fare]).toEqual([
      4,
      'kanpur-central',
      600,
    ]);
  });
});
