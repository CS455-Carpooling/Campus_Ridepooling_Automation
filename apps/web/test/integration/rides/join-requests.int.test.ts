import { describe, expect, it } from 'vitest';
import { GET as listRequests } from '@/app/api/rides/[id]/requests/route';
import { pool } from '@/lib/db';
import { searchRides } from '@/lib/ride-search';
import { callRoute } from '../http';
import {
  actOnRequest,
  joinRide,
  notificationsFor,
  offerRide,
  requestRow,
  requestSeat,
  seatsOf,
  signedInStudent,
} from '../fixtures';

const MINUTE = 60_000;

async function eventsOf(requestId: string) {
  const { rows } = await pool.query(
    `SELECT from_status, to_status, reason_code FROM ride_join_request_events
     WHERE request_id = $1 ORDER BY created_at, id`,
    [requestId],
  );
  return rows;
}

// Core workflow phases 3 and 4 (CS455-111): a rider asks for a seat, the owner decides.
describe('requesting a seat (FR-RD-06)', () => {
  it('records a pending request with its snapshot, history and idempotency key, and tells the owner', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner, { expectedTotalFare: 600 });

    const requested = await requestSeat(rider, ride.id, {
      pickupLocationId: 'hall-5',
      idempotencyKey: 'key-1',
    });
    expect(requested.status).toBe(201);
    const requestId = requested.body.request.requestId;

    expect(await requestRow(requestId)).toMatchObject({
      rider_id: rider.id,
      pickup_location_id: 'hall-5',
      status: 'pending',
      // Two people would share 600.
      snapshot_estimated_share: 300,
    });
    expect(await eventsOf(requestId)).toEqual([
      { from_status: null, to_status: 'pending', reason_code: null },
    ]);
    const key = await pool.query(
      'SELECT request_id FROM ride_join_request_keys WHERE rider_id = $1 AND idempotency_key = $2',
      [rider.id, 'key-1'],
    );
    expect(key.rows).toEqual([{ request_id: requestId }]);
    expect(await notificationsFor(owner.id)).toEqual([
      { type: 'join_request', title: 'New ride request', related_ride_id: ride.id },
    ]);
  });

  it('answers a retried request with the same idempotency key once, without a second request (FR-RD-06.9)', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);

    const first = await requestSeat(rider, ride.id, { idempotencyKey: 'retry-me' });
    const retry = await requestSeat(rider, ride.id, { idempotencyKey: 'retry-me' });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.request).toEqual({
      kind: 'existing',
      requestId: first.body.request.requestId,
      state: 'pending',
      idempotent: true,
    });

    const another = await requestSeat(rider, ride.id, { idempotencyKey: 'a-new-key' });
    expect(another.status).toBe(409);
    expect(another.body.code).toBe('already_requested');

    const counts = await pool.query(
      `SELECT (SELECT count(*)::int FROM ride_join_requests) AS requests,
              (SELECT count(*)::int FROM notifications WHERE user_id = $1) AS owner_notices`,
      [owner.id],
    );
    expect(counts.rows[0]).toEqual({ requests: 1, owner_notices: 1 });
  });

  it('refuses the owner, an unknown pickup point and a fourth waiting request', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);

    const own = await requestSeat(owner, ride.id);
    expect([own.status, own.body.code]).toEqual([409, 'already_requested']);

    const nowhere = await requestSeat(rider, ride.id, { pickupLocationId: 'kanpur-central' });
    expect([nowhere.status, nowhere.body.code]).toEqual([400, 'invalid_pickup']);

    // Three requests may wait for owners at once (P-07); requests do not hold a seat, so the
    // rides may even overlap.
    for (let i = 0; i < 3; i += 1) {
      const other = await offerRide(await signedInStudent());
      expect((await requestSeat(rider, other.id)).status).toBe(201);
    }
    const fourth = await requestSeat(rider, ride.id);
    expect([fourth.status, fourth.body.code]).toEqual([409, 'active_request_limit']);
  });

  it('shows the owner the waiting requests and the rider their own history', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent({ name: 'Rider Ravi' });
    const outsider = await signedInStudent();
    const ride = await offerRide(owner);
    const requestId = (await requestSeat(rider, ride.id)).body.request.requestId;

    const ownerView = await callRoute(listRequests, { params: { id: ride.id }, as: owner });
    expect(ownerView.body.role).toBe('owner');
    expect(ownerView.body.requests).toMatchObject([
      { id: requestId, status: 'pending', riderName: 'Rider Ravi', pickupName: 'Hall 2' },
    ]);

    const riderView = await callRoute(listRequests, { params: { id: ride.id }, as: rider });
    expect(riderView.body.role).toBe('rider');
    expect(riderView.body.requests).toMatchObject([
      { id: requestId, status: 'pending', history: [{ from: null, to: 'pending' }] },
    ]);

    // Someone with no request sees an empty list, not other people's requests.
    const outsiderView = await callRoute(listRequests, { params: { id: ride.id }, as: outsider });
    expect(outsiderView.body).toEqual({ role: 'rider', requests: [] });
  });
});

describe('the owner deciding (FR-RO-05)', () => {
  it('accepting gives the rider a seat, updates everyone’s share and records why', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner, { expectedTotalFare: 600 });
    const requestId = (await requestSeat(rider, ride.id, { pickupLocationId: 'hall-4' })).body
      .request.requestId;

    const accepted = await actOnRequest(owner, ride.id, requestId, 'accept');
    expect(accepted.status).toBe(200);
    expect(accepted.body.result).toEqual({ kind: 'accepted', requestId });

    expect(await seatsOf(ride.id)).toMatchObject([
      { user_id: owner.id, left_at: null },
      { user_id: rider.id, campus_location_id: 'hall-4', left_at: null },
    ]);
    const request = await requestRow(requestId);
    expect(request.status).toBe('accepted');
    expect(request.accepted_at).toBeInstanceOf(Date);
    expect(await eventsOf(requestId)).toMatchObject([
      { to_status: 'pending' },
      { from_status: 'pending', to_status: 'accepted' },
    ]);
    expect((await notificationsFor(rider.id)).map((n) => n.title)).toContain(
      'Your request was accepted',
    );
    // The owner's share went from 600 to 300.
    expect(await notificationsFor(owner.id)).toContainEqual({
      type: 'ride_share_update',
      title: 'Your ride fare share changed',
      related_ride_id: ride.id,
    });
  });

  it('rejecting leaves the seat free and tells the rider', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);
    const requestId = (await requestSeat(rider, ride.id)).body.request.requestId;

    const rejected = await actOnRequest(owner, ride.id, requestId, 'reject');
    expect(rejected.body.result.kind).toBe('rejected');
    expect(await requestRow(requestId)).toMatchObject({
      status: 'rejected',
      reason_code: 'owner_rejected',
    });
    expect(await seatsOf(ride.id)).toHaveLength(1);
    expect((await notificationsFor(rider.id)).map((n) => n.title)).toEqual([
      'Your request was not accepted',
    ]);

    // A decided request cannot be decided again.
    const again = await actOnRequest(owner, ride.id, requestId, 'accept');
    expect([again.status, again.body.code]).toEqual([409, 'request_not_active']);
  });

  it('lets only the owner decide, and only the rider withdraw', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const other = await signedInStudent();
    const ride = await offerRide(owner);
    const requestId = (await requestSeat(rider, ride.id)).body.request.requestId;

    for (const [actor, action, code] of [
      [rider, 'accept', 'not_owner'],
      [other, 'reject', 'not_owner'],
      [owner, 'withdraw', 'not_rider'],
      [other, 'withdraw', 'not_rider'],
    ] as const) {
      const refused = await actOnRequest(actor, ride.id, requestId, action);
      expect([action, refused.status, refused.body.code]).toEqual([action, 403, code]);
    }
    expect((await requestRow(requestId)).status).toBe('pending');
  });
});

describe('the rider changing their mind (FR-RD-06.10, FR-RD-07)', () => {
  it('withdraws a waiting request once, and the owner is told', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);
    const requestId = (await requestSeat(rider, ride.id)).body.request.requestId;

    const withdrawn = await actOnRequest(rider, ride.id, requestId, 'withdraw');
    expect(withdrawn.body.result.kind).toBe('withdrawn');
    expect(await requestRow(requestId)).toMatchObject({
      status: 'withdrawn',
      reason_code: 'rider_withdrew',
    });
    expect((await notificationsFor(owner.id)).map((n) => n.title)).toContain(
      'A rider withdrew their request',
    );

    const again = await actOnRequest(rider, ride.id, requestId, 'withdraw');
    expect([again.status, again.body.code]).toEqual([409, 'request_not_active']);
  });

  it('leaves before lock with nothing owed, freeing the seat for others', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const searcher = await signedInStudent();
    const ride = await offerRide(owner, { vehicleTypeId: 'auto' });
    const requestId = await joinRide(owner, ride.id, rider);

    const left = await actOnRequest(rider, ride.id, requestId, 'leave');
    expect(left.body.result).toEqual({
      kind: 'left',
      requestId,
      lateCancellation: false,
      lockedShare: null,
    });
    const [, riderSeat] = await seatsOf(ride.id);
    expect(riderSeat.left_at).toBeInstanceOf(Date);
    expect(await requestRow(requestId)).toMatchObject({
      status: 'left',
      reason_code: 'rider_left',
      late_cancellation: false,
    });

    const results = await searchRides(searcher.id, {
      direction: 'to_hub',
      hubId: 'kanpur-central',
      campusLocationId: 'hall-2',
      departureStart: new Date(Date.now() + 120 * MINUTE).toISOString(),
      departureEnd: new Date(Date.now() + 300 * MINUTE).toISOString(),
    });
    expect(results.map((r) => [r.id, r.seatsLeft])).toEqual([[ride.id, 2]]);

    // Leaving twice changes nothing.
    const again = await actOnRequest(rider, ride.id, requestId, 'leave');
    expect([again.status, again.body.code]).toEqual([409, 'request_not_active']);
  });
});
