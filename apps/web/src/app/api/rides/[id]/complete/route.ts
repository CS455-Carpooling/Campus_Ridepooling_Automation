import type { PoolClient } from 'pg';
import { getCurrentUser, guard, json } from '@/lib/auth';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { completeRideRefusal, ratingClosesAt, type CompleteRideRefusal } from '@/lib/rating-rules';
import { canViewRide, type RideState, type ViewerRole } from '@/lib/ride-status';

type RideRow = {
  state: RideState;
  departure_start: Date;
  viewer_is_owner: boolean;
  viewer_is_rider: boolean;
};

// Locks the ride, so two requests cannot both complete it, nor race a later cancellation.
const RIDE_SQL = `
  SELECT r.state, r.departure_start,
         (r.owner_id = $2) AS viewer_is_owner,
         EXISTS (SELECT 1 FROM riders m WHERE m.ride_id = r.id AND m.user_id = $2) AS viewer_is_rider
  FROM rides r
  WHERE r.id = $1
  FOR NO KEY UPDATE`;

const COMPLETE_SQL = `
  UPDATE rides SET state = 'completed', completed_at = $2
  WHERE id = $1
  RETURNING id, completed_at`;

const refusals: Record<CompleteRideRefusal, { status: number; error: string }> = {
  not_owner: { status: 403, error: 'Only the ride owner can mark it completed.' },
  cancelled: { status: 409, error: 'A cancelled ride cannot be marked completed.' },
  already_completed: { status: 409, error: 'This ride is already marked completed.' },
  too_early: {
    status: 409,
    error: 'A ride can be marked completed once its departure window has started.',
  },
};

const notFound = () => json({ error: 'Ride not found.', code: 'not_found' }, 404);

/**
 * POST /api/rides/[id]/complete (CS455-41, FR-RO-09.4 in part): the owner marks
 * the ride completed, which opens rating for 72 hours (P-16). It cannot be
 * undone. Anyone who may not see the ride gets the same 404 as for a ride that
 * does not exist, so the answer never reveals whether it does.
 */
export async function POST(_req: Request, ctx: RouteContext<'/api/rides/[id]/complete'>) {
  const blocked = await guard('complete-ride', 30, 900);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const now = new Date();
    const ride = (await client.query<RideRow>(RIDE_SQL, [id, user.id])).rows[0];
    const role: ViewerRole = ride?.viewer_is_owner
      ? 'owner'
      : ride?.viewer_is_rider
        ? 'rider'
        : 'visitor';
    if (!ride || !canViewRide(role, ride.state, ride.departure_start, now)) {
      await client.query('ROLLBACK');
      return notFound();
    }

    const refusal = completeRideRefusal(role, ride.state, ride.departure_start, now);
    if (refusal) {
      await client.query('ROLLBACK');
      const { status, error } = refusals[refusal];
      return json({ error, code: refusal }, status);
    }

    const { rows } = await client.query<{ id: string; completed_at: Date }>(COMPLETE_SQL, [
      id,
      now,
    ]);
    await client.query('COMMIT');
    const completedAt = rows[0].completed_at;
    return json({
      ride: {
        id: rows[0].id,
        state: 'completed',
        completedAt: completedAt.toISOString(),
        ratingClosesAt: ratingClosesAt(completedAt).toISOString(),
      },
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Complete ride failed:', error);
    return json(
      { error: 'Unable to mark the ride completed right now.', code: 'server_error' },
      500,
    );
  } finally {
    client?.release();
  }
}
