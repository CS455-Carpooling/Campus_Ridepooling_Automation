import type { PoolClient } from 'pg';
import { getCurrentUser, guard, json } from '@/lib/auth';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { lockRideForOwner } from '@/lib/join-requests';

export async function POST(_req: Request, ctx: RouteContext<'/api/rides/[id]/lock'>) {
  const blocked = await guard('lock-ride', 20, 900);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await lockRideForOwner(client, id, user.id, new Date());
    if (result.kind !== 'locked') {
      await client.query('ROLLBACK');
      const errors: Record<string, { status: number; error: string }> = {
        not_found: { status: 404, error: 'Ride not found.' },
        not_owner: { status: 403, error: 'Only the ride owner can lock this ride.' },
        not_rider: { status: 403, error: 'This action is not available to this account.' },
        ride_closed: { status: 409, error: 'This ride is no longer scheduled.' },
        ride_locked: { status: 409, error: 'This ride is already locked.' },
      };
      const failure = errors[result.kind] ?? {
        status: 409,
        error: 'The ride could not be locked.',
      };
      return json({ error: failure.error, code: result.kind }, failure.status);
    }
    await client.query('COMMIT');
    return json({ rideId: id, locked: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Lock ride failed:', error);
    return json({ error: 'Unable to lock the ride right now.', code: 'server_error' }, 500);
  } finally {
    client?.release();
  }
}
