import { describe, expect, it } from 'vitest';
import { pool } from '@/lib/db';
import { offerRide, requestRow, requestSeat, signedInStudent } from '../fixtures';

/**
 * Regression: an idempotency key sent again with other details answered with the first request.
 * Asked for ride B with a key first used on ride A, the rider got 200 "already submitted" with
 * ride A's request and no request on B; a pickup point changed on a retry was silently dropped.
 * Found by the adversarial suite (CS455-113). A key now replays only the request it was first
 * sent with (FR-RD-06.9).
 */
describe('an idempotency key sent again with other details', () => {
  it('is refused for another ride, and creates nothing there', async () => {
    const rideA = await offerRide(await signedInStudent());
    const rideB = await offerRide(await signedInStudent());
    const rider = await signedInStudent();
    expect((await requestSeat(rider, rideA.id, { idempotencyKey: 'reused' })).status).toBe(201);

    const onB = await requestSeat(rider, rideB.id, { idempotencyKey: 'reused' });
    expect([onB.status, onB.body.code]).toEqual([409, 'idempotency_key_reused']);
    const requests = await pool.query('SELECT ride_id FROM ride_join_requests');
    expect(requests.rows).toEqual([{ ride_id: rideA.id }]);

    // A new key for ride B works.
    expect((await requestSeat(rider, rideB.id, { idempotencyKey: 'fresh' })).status).toBe(201);
  });

  it('is refused for another pickup point, keeping the first request as it was', async () => {
    const ride = await offerRide(await signedInStudent());
    const rider = await signedInStudent();
    const first = await requestSeat(rider, ride.id, {
      pickupLocationId: 'hall-2',
      idempotencyKey: 'retry',
    });

    const changed = await requestSeat(rider, ride.id, {
      pickupLocationId: 'hall-9',
      idempotencyKey: 'retry',
    });
    expect([changed.status, changed.body.code]).toEqual([409, 'idempotency_key_reused']);
    expect((await requestRow(first.body.request.requestId)).pickup_location_id).toBe('hall-2');
  });

  it('still replays the same request sent again unchanged', async () => {
    const ride = await offerRide(await signedInStudent());
    const rider = await signedInStudent();
    const first = await requestSeat(rider, ride.id, { idempotencyKey: 'same' });
    const again = await requestSeat(rider, ride.id, { idempotencyKey: 'same' });
    expect(again.status).toBe(200);
    expect(again.body.request).toMatchObject({
      kind: 'existing',
      requestId: first.body.request.requestId,
    });
  });
});
