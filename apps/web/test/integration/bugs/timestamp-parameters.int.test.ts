import { describe, expect, it } from 'vitest';
import { pool } from '@/lib/db';
import { sendDuePaymentReminders } from '@/lib/payment-settlement';
import { offerRide, signedInStudent } from '../fixtures';
import { callRoute } from '../http';
import { POST as submitRequest } from '@/app/api/rides/[id]/requests/route';

/**
 * Regression: `$n - interval '...'` with a JavaScript Date parameter. node-postgres sends the
 * Date untyped, Postgres reads `$n - interval` as interval minus interval, and the comparison
 * with a timestamptz column fails ("operator does not exist: timestamp with time zone <
 * interval"). Mocked unit tests cannot see this; only a real database can. Found by the
 * integration harness (CS455-110): every seat request answered 500.
 */

/** A completed ride `daysAgo` days ago on which `riderId` still owes their share. */
async function unpaidShare(riderId: string, daysAgo: number) {
  const owner = await signedInStudent();
  const { rows } = await pool.query(
    `INSERT INTO rides (owner_id, direction, hub_id, vehicle_type_id, capacity_snapshot,
                        departure_start, departure_end, expected_total_fare, state, completed_at)
     VALUES ($1, 'to_hub', 'kanpur-central', 'car', 4,
             now() - make_interval(days => $2) - interval '2 hours',
             now() - make_interval(days => $2) - interval '1 hour',
             400, 'completed', now() - make_interval(days => $2))
     RETURNING id, completed_at`,
    [owner.id, daysAgo],
  );
  // The app writes final shares when the ride completes (trip.ts), so these date from then too.
  // Left at now(), a share could look newer than a reminder stamped moments later by the test's
  // clock (the database's clock runs about a millisecond ahead), and the share trigger, which
  // refuses a reminder older than its share, failed the reminder test about 1 run in 12.
  await pool.query(
    `INSERT INTO ride_final_shares
       (ride_id, user_id, role, position, share, payment_status, created_at)
     VALUES ($1, $2, 'owner', 1, 200, NULL, $4), ($1, $3, 'rider', 2, 200, 'due', $4)`,
    [rows[0].id, owner.id, riderId, rows[0].completed_at],
  );
  return rows[0].id as string;
}

async function ask(rider: { token: string }, rideId: string) {
  return callRoute(submitRequest, {
    method: 'POST',
    params: { id: rideId },
    as: rider,
    body: { pickupLocationId: 'hall-2', idempotencyKey: crypto.randomUUID() },
  });
}

describe('timestamp parameters compared with an interval', () => {
  it('lets a rider with no unpaid shares request a seat', async () => {
    const ride = await offerRide(await signedInStudent());
    const rider = await signedInStudent();

    const requested = await ask(rider, ride.id);
    expect(requested.status).toBe(201);
    expect(requested.body.request).toMatchObject({ kind: 'created', state: 'pending' });
  });

  it('still refuses a rider whose share has been due for more than seven days', async () => {
    const rider = await signedInStudent();
    await unpaidShare(rider.id, 8);
    const ride = await offerRide(await signedInStudent());

    const refused = await ask(rider, ride.id);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('payment_overdue');
  });

  it('allows a share that has been due for less than seven days', async () => {
    const rider = await signedInStudent();
    await unpaidShare(rider.id, 6);
    const ride = await offerRide(await signedInStudent());

    expect((await ask(rider, ride.id)).status).toBe(201);
  });

  it('sends each payment reminder once, 24 hours and then 72 hours after completion', async () => {
    const rider = await signedInStudent();
    const rideId = await unpaidShare(rider.id, 2);

    const run = async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const sent = await sendDuePaymentReminders(client, new Date());
        await client.query('COMMIT');
        return sent;
      } finally {
        client.release();
      }
    };

    expect(await run()).toBe(1);
    expect(await run()).toBe(0);
    const share = await pool.query(
      'SELECT reminder_24_at, reminder_72_at FROM ride_final_shares WHERE ride_id = $1 AND user_id = $2',
      [rideId, rider.id],
    );
    expect(share.rows[0].reminder_24_at).toBeInstanceOf(Date);
    expect(share.rows[0].reminder_72_at).toBeNull();

    await pool.query(`UPDATE rides SET completed_at = now() - interval '4 days' WHERE id = $1`, [
      rideId,
    ]);
    expect(await run()).toBe(1);
    const titles = await pool.query(
      `SELECT title FROM notifications WHERE user_id = $1 ORDER BY created_at`,
      [rider.id],
    );
    expect(titles.rows.map((row) => row.title)).toEqual([
      'Ride share payment reminder (24h)',
      'Ride share payment reminder (72h)',
    ]);
  });
});
