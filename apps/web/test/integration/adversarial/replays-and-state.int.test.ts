import { describe, expect, it } from 'vitest';
import { PATCH as manageRide } from '@/app/api/rides/[id]/route';
import { POST as raiseSos } from '@/app/api/rides/[id]/sos/route';
import { pool } from '@/lib/db';
import { callRoute } from '../http';
import {
  actOnRequest,
  checkIn,
  joinRide,
  markSeat,
  offerRide,
  pooledRide,
  requestRow,
  requestSeat,
  seatsOf,
  signedInStudent,
  tripStep,
} from '../fixtures';

// Adversarial (CS455-113): repeated and out-of-order requests.
describe('replayed requests', () => {
  it('refuses a different pickup sent with an idempotency key already used (bug 2, #87)', async () => {
    const ride = await offerRide(await signedInStudent());
    const rider = await signedInStudent();
    const first = await requestSeat(rider, ride.id, {
      pickupLocationId: 'hall-2',
      idempotencyKey: 'same-key',
    });
    const replay = await requestSeat(rider, ride.id, {
      pickupLocationId: 'hall-9',
      idempotencyKey: 'same-key',
    });
    // Before the fix: 200 with the first request, the new pickup point silently dropped.
    expect([replay.status, replay.body.code]).toEqual([409, 'idempotency_key_reused']);
    expect((await requestRow(first.body.request.requestId)).pickup_location_id).toBe('hall-2');
  });

  it('does not answer a request for one ride with a request on another (bug 2, #87)', async () => {
    const rideA = await offerRide(await signedInStudent());
    const rideB = await offerRide(await signedInStudent());
    const rider = await signedInStudent();
    expect((await requestSeat(rider, rideA.id, { idempotencyKey: 'reused-key' })).status).toBe(201);

    // The client reuses its key for another ride: it must not be told it asked for this one.
    const onB = await requestSeat(rider, rideB.id, { idempotencyKey: 'reused-key' });
    expect(onB.status).toBe(409);
    expect(onB.body.code).toBe('idempotency_key_reused');
    const requests = await pool.query('SELECT ride_id FROM ride_join_requests');
    expect(requests.rows).toEqual([{ ride_id: rideA.id }]);
  });

  it('accepts a request once, however often the owner clicks', async () => {
    const owner = await signedInStudent();
    const ride = await offerRide(owner);
    const requestId = (await requestSeat(await signedInStudent(), ride.id)).body.request.requestId;

    expect((await actOnRequest(owner, ride.id, requestId, 'accept')).status).toBe(200);
    const again = await actOnRequest(owner, ride.id, requestId, 'accept');
    expect([again.status, again.body.code]).toEqual([409, 'request_not_active']);
    expect(await seatsOf(ride.id)).toHaveLength(2);
  });
});

describe('actions out of order', () => {
  it('refuses requests, decisions and edits on a cancelled ride', async () => {
    const owner = await signedInStudent();
    const ride = await offerRide(owner);
    const waiting = (await requestSeat(await signedInStudent(), ride.id)).body.request.requestId;
    const cancel = await callRoute(manageRide, {
      method: 'PATCH',
      params: { id: ride.id },
      as: owner,
      body: { action: 'cancel' },
    });
    expect(cancel.status).toBe(200);

    const late = await requestSeat(await signedInStudent(), ride.id);
    expect([late.status, late.body.code]).toEqual([409, 'ride_closed']);
    const accept = await actOnRequest(owner, ride.id, waiting, 'accept');
    expect([accept.status, accept.body.code]).toEqual([409, 'ride_closed']);
    const edit = await callRoute(manageRide, {
      method: 'PATCH',
      params: { id: ride.id },
      as: owner,
      body: { action: 'edit', expectedTotalFare: 700 },
    });
    expect(edit.status).toBe(409);
    const pickup = await tripStep(owner, ride.id, 'pickup_in_progress');
    expect([pickup.status, pickup.body.code]).toEqual([409, 'cancelled']);
  });

  it('refuses leaving, checking in and new requests once pickup has started', async () => {
    const { owner, ride, riders, requestIds } = await pooledRide({ riders: 1, startsIn: 30 });
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    expect((await tripStep(owner, ride.id, 'in_transit')).status).toBe(200);

    const leave = await actOnRequest(riders[0], ride.id, requestIds[0], 'leave', {
      confirmLate: true,
    });
    expect([leave.status, leave.body.code]).toEqual([409, 'trip_started']);
    const late = await checkIn(riders[0], ride.id);
    expect(late.status).toBe(409);
    const join = await requestSeat(await signedInStudent(), ride.id);
    expect([join.status, join.body.code]).toEqual([409, 'ride_closed']);
  });

  it('refuses pickup actions and SOS after completion', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1, startsIn: 30 });
    for (const step of ['pickup_in_progress', 'completed']) {
      expect((await tripStep(owner, ride.id, step)).status).toBe(200);
    }
    const [, seat] = await seatsOf(ride.id);

    expect((await markSeat(owner, ride.id, seat.id, 'not_arrived')).status).toBe(409);
    const sos = await callRoute(raiseSos, {
      method: 'POST',
      params: { id: ride.id },
      as: riders[0],
    });
    expect([sos.status, sos.body.code]).toEqual([409, 'not_active']);
    const cancel = await callRoute(manageRide, {
      method: 'PATCH',
      params: { id: ride.id },
      as: owner,
      body: { action: 'cancel' },
    });
    expect(cancel.status).toBe(409);
  });

  it('refuses a rider who left acting on the ride again', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);
    const requestId = await joinRide(owner, ride.id, rider);
    expect((await actOnRequest(rider, ride.id, requestId, 'leave')).status).toBe(200);

    const reaccept = await actOnRequest(owner, ride.id, requestId, 'accept');
    expect([reaccept.status, reaccept.body.code]).toEqual([409, 'request_not_active']);
    // They may ask again with a new request, as anyone may.
    expect((await requestSeat(rider, ride.id)).status).toBe(201);
  });
});
