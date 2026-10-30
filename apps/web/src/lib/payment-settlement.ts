import 'server-only';
import type { PoolClient } from 'pg';
import type { PaymentInput, PaymentStatus } from './payment-rules';

export type SettlementAction =
  { type: 'paid'; input: PaymentInput } | { type: 'confirm' } | { type: 'dispute' };

export type SettlementResult =
  | { kind: 'done'; status: PaymentStatus; complaintReference?: string }
  | { kind: 'not_found' }
  | { kind: 'not_owner' }
  | { kind: 'not_rider' }
  | { kind: 'not_completed' }
  | { kind: 'no_payable_share' }
  | { kind: 'already_handled' };

type SettlementRow = {
  owner_id: string;
  ride_state: string;
  user_id: string;
  no_show_at: Date | null;
  role: 'owner' | 'rider' | null;
  share: number | null;
  payment_status: PaymentStatus | null;
  payment_method: 'upi' | 'cash' | null;
  payment_reference: string | null;
};

/**
 * Applies the payer/owner transition under the ride lock. One ride lock serializes duplicate
 * submissions and competing owner decisions; the database row/constraints remain authoritative.
 */
export async function changeSettlement(
  client: PoolClient,
  rideId: string,
  occupantId: string,
  actorId: string,
  action: SettlementAction,
  now: Date,
): Promise<SettlementResult> {
  const { rows } = await client.query<SettlementRow>(
    `SELECT ride.owner_id, ride.state AS ride_state, seat.user_id, seat.no_show_at,
            final.role, final.share, final.payment_status, final.payment_method,
            final.payment_reference
     FROM rides ride
     JOIN riders seat ON seat.ride_id = ride.id AND seat.id = $2
     LEFT JOIN ride_final_shares final
       ON final.ride_id = ride.id AND final.user_id = seat.user_id
     WHERE ride.id = $1
     FOR UPDATE OF ride, seat`,
    [rideId, occupantId],
  );
  const target = rows[0];
  if (!target) return { kind: 'not_found' };
  if (action.type === 'paid' && actorId !== target.user_id) return { kind: 'not_rider' };
  if (action.type !== 'paid' && actorId !== target.owner_id) return { kind: 'not_owner' };
  if (target.ride_state !== 'completed') return { kind: 'not_completed' };
  if (!target.role || target.share === null || !target.payment_status) {
    return { kind: 'no_payable_share' };
  }
  if (target.role !== 'rider' || target.no_show_at) return { kind: 'no_payable_share' };

  if (action.type === 'paid') {
    if (
      target.payment_status === 'paid' &&
      target.payment_method === action.input.method &&
      target.payment_reference === action.input.reference
    ) {
      return { kind: 'done', status: 'paid' };
    }
    if (target.payment_status !== 'due') return { kind: 'already_handled' };
    await client.query(
      `UPDATE ride_final_shares
       SET payment_status = 'paid', payment_method = $3, payment_reference = $4, paid_at = $5
       WHERE ride_id = $1 AND user_id = $2 AND payment_status = 'due'`,
      [rideId, target.user_id, action.input.method, action.input.reference, now],
    );
    await notify(
      client,
      target.owner_id,
      rideId,
      'payment_update',
      'Rider marked their share paid',
      'A rider marked their ride share as paid. Review it on the ride page.',
      now,
    );
    return { kind: 'done', status: 'paid' };
  }

  if (target.payment_status === 'confirmed' && action.type === 'confirm') {
    return { kind: 'done', status: 'confirmed' };
  }
  if (target.payment_status === 'disputed' && action.type === 'dispute') {
    const existing = await client.query<{ reference: string }>(
      `SELECT reference FROM complaints
       WHERE ride_id = $1 AND complainant_id = $2 AND accused_id = $3
         AND source = 'payment_dispute' LIMIT 1`,
      [rideId, target.user_id, target.owner_id],
    );
    return { kind: 'done', status: 'disputed', complaintReference: existing.rows[0]?.reference };
  }
  if (target.payment_status !== 'paid') return { kind: 'already_handled' };

  let complaintReference: string | undefined;
  if (action.type === 'dispute') {
    let complaint = await client.query<{ reference: string }>(
      `INSERT INTO complaints
         (ride_id, complainant_id, accused_id, category, description, source)
       VALUES ($1, $2, $3, 'payment', $4, 'payment_dispute')
       ON CONFLICT (complainant_id, ride_id, accused_id) WHERE source = 'payment_dispute'
       DO NOTHING
       RETURNING reference`,
      [
        rideId,
        target.user_id,
        target.owner_id,
        `The rider disputed the payment of ₹${target.share}.`,
      ],
    );
    if (!complaint.rows[0]) {
      complaint = await client.query<{ reference: string }>(
        `SELECT reference FROM complaints
         WHERE ride_id = $1 AND complainant_id = $2 AND accused_id = $3
           AND source = 'payment_dispute' LIMIT 1`,
        [rideId, target.user_id, target.owner_id],
      );
    }
    complaintReference = complaint.rows[0]?.reference;
    await client.query(
      `UPDATE ride_final_shares SET payment_status = 'disputed', responded_at = $3
       WHERE ride_id = $1 AND user_id = $2 AND payment_status = 'paid'`,
      [rideId, target.user_id, now],
    );
  } else {
    await client.query(
      `UPDATE ride_final_shares SET payment_status = 'confirmed', responded_at = $3
       WHERE ride_id = $1 AND user_id = $2 AND payment_status = 'paid'`,
      [rideId, target.user_id, now],
    );
  }
  await notify(
    client,
    target.user_id,
    rideId,
    'payment_update',
    action.type === 'confirm' ? 'Payment confirmed' : 'Payment disputed',
    action.type === 'confirm'
      ? 'The ride owner confirmed receipt of your share.'
      : 'The ride owner disputed your payment. A Payment complaint has been opened for review.',
    now,
  );
  return {
    kind: 'done',
    status: action.type === 'confirm' ? 'confirmed' : 'disputed',
    ...(complaintReference ? { complaintReference } : {}),
  };
}

async function notify(
  client: PoolClient,
  userId: string,
  rideId: string,
  type: 'payment_due' | 'payment_update',
  title: string,
  body: string,
  now: Date,
) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, related_ride_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, body, rideId, now],
  );
}

/** Sends each reminder once. Caller owns the transaction; row locks make concurrent runs safe. */
export async function sendDuePaymentReminders(client: PoolClient, now: Date): Promise<number> {
  const { rows } = await client.query<{
    user_id: string;
  }>(
    `WITH candidates AS (
       SELECT share.ride_id, share.user_id,
              CASE WHEN share.reminder_24_at IS NULL THEN 24 ELSE 72 END AS reminder
       FROM ride_final_shares share
       JOIN rides ride ON ride.id = share.ride_id
       WHERE share.role = 'rider' AND share.payment_status = 'due'
         AND ((share.reminder_24_at IS NULL
               AND ride.completed_at <= $1::timestamptz - interval '24 hours')
           OR (share.reminder_24_at IS NOT NULL AND share.reminder_72_at IS NULL
               AND ride.completed_at <= $1::timestamptz - interval '72 hours'))
       ORDER BY ride.completed_at
       LIMIT 500
       FOR UPDATE OF share SKIP LOCKED
     ),
     updated AS (
       UPDATE ride_final_shares share
       SET reminder_24_at = CASE WHEN candidates.reminder = 24 THEN $1 ELSE share.reminder_24_at END,
           reminder_72_at = CASE WHEN candidates.reminder = 72 THEN $1 ELSE share.reminder_72_at END
       FROM candidates
       WHERE share.ride_id = candidates.ride_id
         AND share.user_id = candidates.user_id
         AND share.payment_status = 'due'
         AND (
           (candidates.reminder = 24 AND share.reminder_24_at IS NULL)
           OR (candidates.reminder = 72 AND share.reminder_72_at IS NULL)
         )
       RETURNING share.user_id, share.ride_id, candidates.reminder
     )
     INSERT INTO notifications
       (user_id, type, title, body, related_ride_id, created_at)
     SELECT user_id, 'payment_due',
            'Ride share payment reminder (' || reminder || 'h)',
            'Your ride share is still due. Settle with the ride owner outside the app and mark it paid.',
            ride_id, $1
     FROM updated
     RETURNING user_id`,
    [now],
  );
  return rows.length;
}
