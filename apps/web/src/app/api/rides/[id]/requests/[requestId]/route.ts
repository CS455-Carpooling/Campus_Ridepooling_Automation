import type { PoolClient } from 'pg';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { actOnJoinRequest, type JoinRequestAction } from '@/lib/join-requests';

type RequestActionContext = RouteContext<'/api/rides/[id]/requests/[requestId]'>;

const allowedActions = new Set<JoinRequestAction>([
  'accept',
  'reject',
  'reconfirm',
  'decline',
  'withdraw',
  'leave',
]);

const failures: Record<string, { status: number; error: string }> = {
  not_found: { status: 404, error: 'Ride or request not found.' },
  not_owner: { status: 403, error: 'Only the ride owner can decide requests.' },
  not_rider: { status: 403, error: 'This request does not belong to you.' },
  suspended: { status: 403, error: 'The rider is suspended and cannot join a ride.' },
  ride_closed: { status: 409, error: 'This ride is no longer active.' },
  ride_locked: { status: 409, error: 'The ride is locked; no requests can be accepted.' },
  ride_full: {
    status: 409,
    error: 'The ride has no available seats. The request remains pending.',
  },
  pickup_estimate_unavailable: {
    status: 409,
    error: 'A pickup-time estimate is unavailable for this route.',
  },
  request_not_active: { status: 409, error: 'This request is no longer active.' },
  request_not_pending: { status: 409, error: 'The rider must reconfirm before you can accept.' },
  request_not_reconfirming: { status: 409, error: 'This request does not need reconfirmation.' },
  late_confirmation_required: {
    status: 409,
    error: 'Leaving after lock keeps your locked share payable. Confirm to continue.',
  },
  trip_started: { status: 409, error: 'You cannot leave after pickup has started.' },
  cannot_leave_owner_seat: { status: 409, error: 'The ride owner cannot leave their own ride.' },
};

export async function PATCH(req: Request, ctx: RequestActionContext) {
  const blocked = await guard('change-ride-request', 30, 900);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id, requestId } = await ctx.params;
  if (!isUuid(id) || !isUuid(requestId)) {
    return json({ error: 'Ride or request not found.', code: 'not_found' }, 404);
  }
  const body = await readJson(req);
  if (typeof body.action !== 'string' || !allowedActions.has(body.action as JoinRequestAction)) {
    return json({ error: 'Choose a valid request action.', code: 'invalid_action' }, 400);
  }
  const action = body.action as JoinRequestAction;
  if (body.confirmLate !== undefined && typeof body.confirmLate !== 'boolean') {
    return json(
      { error: 'The late-leave confirmation is invalid.', code: 'invalid_confirmation' },
      400,
    );
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await actOnJoinRequest(
      client,
      id,
      requestId,
      user.id,
      action,
      new Date(),
      body.confirmLate === true,
    );
    const changed = [
      'accepted',
      'rejected',
      'reconfirmed',
      'withdrawn',
      'left',
      'expired',
    ].includes(result.kind);
    if (changed) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
    if (!changed) {
      const failure = failures[result.kind] ?? {
        status: 409,
        error:
          ('detail' in result ? result.detail : undefined) ?? 'The request could not be changed.',
      };
      return json({ error: failure.error, code: result.kind }, failure.status);
    }
    return json({ result }, result.kind === 'accepted' ? 200 : 200);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Change ride request failed:', error);
    return json({ error: 'Unable to change the request right now.', code: 'server_error' }, 500);
  } finally {
    client?.release();
  }
}
