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

  // Review follow-up (Khushi): a new key sent several times at once must be claimed once. Each
  // submission locks the rider's users row first, so they run one after another and later ones
  // see the first one's key; the key table's primary key is the backstop.
  it('is claimed once when its first uses for different rides arrive at the same moment', async () => {
    for (let round = 0; round < 5; round += 1) {
      const rideA = await offerRide(await signedInStudent());
      const rideB = await offerRide(await signedInStudent());
      const rider = await signedInStudent();
      const rides = [rideA, rideB, rideA, rideB];

      const sent = await Promise.all(
        rides.map((ride) => requestSeat(rider, ride.id, { idempotencyKey: 'raced' })),
      );

      const created = await pool.query<{ id: string; ride_id: string }>(
        'SELECT id, ride_id FROM ride_join_requests WHERE rider_id = $1',
        [rider.id],
      );
      expect(created.rows).toHaveLength(1);
      const [winner] = created.rows;
      const keys = await pool.query(
        'SELECT request_id FROM ride_join_request_keys WHERE rider_id = $1',
        [rider.id],
      );
      expect(keys.rows).toEqual([{ request_id: winner.id }]);

      // Sends for the winning ride get its request (one creates it, one replays it); sends for
      // the other ride are refused, never answered with the winner's request.
      expect(sent.map((result) => result.status).sort()).toEqual([200, 201, 409, 409]);
      sent.forEach((result, index) => {
        if (rides[index].id === winner.ride_id) {
          expect(result.body.request.requestId).toBe(winner.id);
        } else {
          expect(result.body.code).toBe('idempotency_key_reused');
        }
      });
    }
  });

  it('cannot be claimed twice even past the application, by the key table itself', async () => {
    const ride = await offerRide(await signedInStudent());
    const rider = await signedInStudent();
    const first = await requestSeat(rider, ride.id, { idempotencyKey: 'claimed' });

    await expect(
      pool.query(
        `INSERT INTO ride_join_request_keys (rider_id, idempotency_key, request_id, expires_at)
         VALUES ($1, 'claimed', $2, now() + interval '1 day')`,
        [rider.id, first.body.request.requestId],
      ),
    ).rejects.toMatchObject({ code: '23505' });
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
