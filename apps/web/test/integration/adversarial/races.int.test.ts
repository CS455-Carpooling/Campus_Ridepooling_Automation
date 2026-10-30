import { describe, expect, it } from 'vitest';
import { POST as lockRide } from '@/app/api/rides/[id]/lock/route';
import { POST as raiseSos } from '@/app/api/rides/[id]/sos/route';
import { POST as createRide } from '@/app/api/rides/route';
import { pool } from '@/lib/db';
import { callRoute } from '../http';
import {
  actOnRequest,
  joinRide,
  offerRide,
  pooledRide,
  requestRow,
  requestSeat,
  rideOffer,
  seatsOf,
  signedInStudent,
  tripStep,
} from '../fixtures';

const statuses = (answers: Array<{ status: number }>) => answers.map((a) => a.status).sort();

// Adversarial (CS455-113): a few requests at the same moment, as double clicks and two people
// acting at once produce. Each runs on its own pooled connection, so they really overlap in the
// database. The 50-request last-seat experiment (NFR-RD-05) is in the concurrency report.
describe('requests at the same moment', () => {
  it('gives the last seat to exactly one of two accepted riders', async () => {
    const owner = await signedInStudent();
    // An auto with the owner and one rider: one seat left.
    const ride = await offerRide(owner, { vehicleTypeId: 'auto' });
    await joinRide(owner, ride.id, await signedInStudent());
    const [a, b] = await Promise.all([signedInStudent(), signedInStudent()]);
    const ra = (await requestSeat(a, ride.id)).body.request.requestId;
    const rb = (await requestSeat(b, ride.id)).body.request.requestId;

    const answers = await Promise.all([
      actOnRequest(owner, ride.id, ra, 'accept'),
      actOnRequest(owner, ride.id, rb, 'accept'),
    ]);
    expect(statuses(answers)).toEqual([200, 409]);
    expect(answers.find((x) => x.status === 409)?.body.code).toBe('ride_full');
    expect((await seatsOf(ride.id)).filter((seat) => seat.left_at === null)).toHaveLength(3);
  });

  it('never leaves a seat without an accepted request when accept and withdraw race', async () => {
    const owner = await signedInStudent();
    const rider = await signedInStudent();
    const ride = await offerRide(owner);
    const requestId = (await requestSeat(rider, ride.id)).body.request.requestId;

    const [accept, withdraw] = await Promise.all([
      actOnRequest(owner, ride.id, requestId, 'accept'),
      actOnRequest(rider, ride.id, requestId, 'withdraw'),
    ]);
    // Exactly one wins; the other is told the request is no longer active.
    expect(statuses([accept, withdraw])).toEqual([200, 409]);
    const status = (await requestRow(requestId)).status;
    const seated = (await seatsOf(ride.id)).some((seat) => seat.user_id === rider.id);
    expect([status, seated]).toEqual(
      accept.status === 200 ? ['accepted', true] : ['withdrawn', false],
    );
  });

  it('creates one request for a double-clicked submit with one key', async () => {
    const ride = await offerRide(await signedInStudent());
    const rider = await signedInStudent();
    const answers = await Promise.all(
      Array.from({ length: 5 }, () => requestSeat(rider, ride.id, { idempotencyKey: 'click' })),
    );
    expect(statuses(answers)).toEqual([200, 200, 200, 200, 201]);
    const rows = await pool.query('SELECT count(*)::int AS n FROM ride_join_requests');
    expect(rows.rows[0].n).toBe(1);
    expect(new Set(answers.map((a) => a.body.request.requestId)).size).toBe(1);
  });

  it('locks once when the owner double-clicks Lock', async () => {
    const owner = await signedInStudent();
    const ride = await offerRide(owner);
    await joinRide(owner, ride.id, await signedInStudent());
    const answers = await Promise.all(
      [1, 2, 3].map(() =>
        callRoute(lockRide, { method: 'POST', params: { id: ride.id }, as: owner }),
      ),
    );
    expect(statuses(answers)).toEqual([200, 409, 409]);
    expect((await seatsOf(ride.id)).map((seat) => seat.locked_share)).toEqual([300, 300]);
  });

  it('raises one SOS for five quick taps', async () => {
    const { owner, ride, riders } = await pooledRide({ riders: 1, startsIn: 30 });
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const answers = await Promise.all(
      Array.from({ length: 5 }, () =>
        callRoute(raiseSos, { method: 'POST', params: { id: ride.id }, as: riders[0] }),
      ),
    );
    expect(statuses(answers)).toEqual([200, 200, 200, 200, 201]);
    expect(new Set(answers.map((a) => a.body.incident.id)).size).toBe(1);
  });

  it('writes the final shares once when completion is sent twice at once', async () => {
    const { owner, ride } = await pooledRide({ riders: 2, startsIn: 30, fare: 900 });
    expect((await tripStep(owner, ride.id, 'pickup_in_progress')).status).toBe(200);
    const answers = await Promise.all([
      tripStep(owner, ride.id, 'completed'),
      tripStep(owner, ride.id, 'completed'),
    ]);
    expect(statuses(answers)).toEqual([200, 200]);
    const shares = await pool.query(
      'SELECT count(*)::int AS n, sum(share)::int AS total FROM ride_final_shares WHERE ride_id = $1',
      [ride.id],
    );
    expect(shares.rows[0]).toEqual({ n: 3, total: 900 });
  });

  it('offers one ride when the same offer is sent twice at once', async () => {
    const owner = await signedInStudent();
    const body = rideOffer();
    const answers = await Promise.all([
      callRoute(createRide, { method: 'POST', as: owner, body }),
      callRoute(createRide, { method: 'POST', as: owner, body }),
    ]);
    expect(statuses(answers)).toEqual([201, 409]);
    const rides = await pool.query('SELECT count(*)::int AS n FROM rides');
    expect(rides.rows[0].n).toBe(1);
  });
});

describe('the per-address rate limit', () => {
  it('turns away the 21st ride offer from one address in 15 minutes', async () => {
    const owner = await signedInStudent();
    const answers = [];
    for (let i = 0; i < 21; i += 1) {
      // Invalid bodies: the limit counts attempts, before anything is checked or stored.
      answers.push(
        await callRoute(createRide, { method: 'POST', as: owner, ip: '10.9.9.9', body: {} }),
      );
    }
    expect(answers.slice(0, 20).every((a) => a.status === 400)).toBe(true);
    expect(answers[20].status).toBe(429);
    // Another address is not affected.
    expect(
      (await callRoute(createRide, { method: 'POST', as: owner, ip: '10.9.9.10', body: {} }))
        .status,
    ).toBe(400);
  });
});
