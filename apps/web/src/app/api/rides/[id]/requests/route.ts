import type { PoolClient } from 'pg';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { parseJoinRequestInput } from '@/lib/join-request-rules';
import { submitJoinRequest } from '@/lib/join-requests';

type RequestRouteContext = RouteContext<'/api/rides/[id]/requests'>;

export async function GET(_req: Request, ctx: RequestRouteContext) {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);

  const ride = await pool.query<{ owner_id: string }>('SELECT owner_id FROM rides WHERE id = $1', [
    id,
  ]);
  if (!ride.rows[0]) return json({ error: 'Ride not found.', code: 'not_found' }, 404);

  if (ride.rows[0].owner_id === user.id) {
    const { rows } = await pool.query<{
      id: string;
      status: string;
      reason_code: string | null;
      submitted_at: Date;
      snapshot_departure_start: Date;
      snapshot_pickup_at: Date;
      snapshot_estimated_share: number;
      current_departure_start: Date | null;
      current_pickup_at: Date | null;
      current_estimated_share: number | null;
      rider_name: string;
      pickup_name: string;
      visible_tags: string[] | null;
    }>(
      `SELECT request.id, request.status, request.reason_code, request.submitted_at,
              request.snapshot_departure_start, request.snapshot_pickup_at,
              request.snapshot_estimated_share, request.current_departure_start,
              request.current_pickup_at, request.current_estimated_share,
              COALESCE(profile.display_name, rider.full_name) AS rider_name,
              pickup.name AS pickup_name,
              COALESCE(tags.visible_tags, ARRAY[]::text[]) AS visible_tags
       FROM ride_join_requests request
       JOIN users rider ON rider.id = request.rider_id
       LEFT JOIN user_profiles profile ON profile.user_id = rider.id
       JOIN locations pickup ON pickup.id = request.pickup_location_id
       LEFT JOIN LATERAL (
         SELECT array_agg(tag.name ORDER BY tag.name) AS visible_tags
         FROM user_profile_tags selected
         JOIN interest_tags tag ON tag.id = selected.tag_id AND tag.is_active = true
         WHERE selected.user_id = rider.id AND selected.is_visible = true
       ) tags ON true
       WHERE request.ride_id = $1 AND request.status IN ('pending', 'needs_reconfirmation')
       ORDER BY request.submitted_at, request.id`,
      [id],
    );
    return json({
      role: 'owner',
      requests: rows.map((row) => ({
        id: row.id,
        status: row.status,
        reasonCode: row.reason_code,
        submittedAt: row.submitted_at.toISOString(),
        riderName: row.rider_name,
        pickupName: row.pickup_name,
        visibleTags: row.visible_tags ?? [],
        agreed: {
          departureStart: row.snapshot_departure_start.toISOString(),
          pickupAt: row.snapshot_pickup_at.toISOString(),
          estimatedShare: row.snapshot_estimated_share,
        },
        current: {
          departureStart:
            row.current_departure_start?.toISOString() ??
            row.snapshot_departure_start.toISOString(),
          pickupAt: row.current_pickup_at?.toISOString() ?? row.snapshot_pickup_at.toISOString(),
          estimatedShare: row.current_estimated_share ?? row.snapshot_estimated_share,
        },
      })),
    });
  }

  const { rows } = await pool.query<{
    id: string;
    status: string;
    reason_code: string | null;
    submitted_at: Date;
    accepted_at: Date | null;
    snapshot_departure_start: Date;
    snapshot_pickup_at: Date;
    snapshot_estimated_share: number;
    current_departure_start: Date | null;
    current_pickup_at: Date | null;
    current_estimated_share: number | null;
    late_cancellation: boolean;
    locked_share: number | null;
  }>(
    `SELECT id, status, reason_code, submitted_at, accepted_at,
            snapshot_departure_start, snapshot_pickup_at, snapshot_estimated_share,
            current_departure_start, current_pickup_at, current_estimated_share,
            late_cancellation, locked_share
     FROM ride_join_requests
     WHERE ride_id = $1 AND rider_id = $2
     ORDER BY submitted_at DESC, id DESC`,
    [id, user.id],
  );
  const events = await pool.query<{
    request_id: string;
    from_status: string | null;
    to_status: string;
    reason_code: string | null;
    details: Record<string, unknown>;
    created_at: Date;
  }>(
    `SELECT event.request_id, event.from_status, event.to_status, event.reason_code,
            event.details, event.created_at
     FROM ride_join_request_events event
     JOIN ride_join_requests request ON request.id = event.request_id
     WHERE request.ride_id = $1 AND request.rider_id = $2
     ORDER BY event.created_at, event.id`,
    [id, user.id],
  );
  return json({
    role: 'rider',
    requests: rows.map((row) => ({
      id: row.id,
      status: row.status,
      reasonCode: row.reason_code,
      submittedAt: row.submitted_at.toISOString(),
      acceptedAt: row.accepted_at?.toISOString() ?? null,
      agreed: {
        departureStart: row.snapshot_departure_start.toISOString(),
        pickupAt: row.snapshot_pickup_at.toISOString(),
        estimatedShare: row.snapshot_estimated_share,
      },
      current: {
        departureStart:
          row.current_departure_start?.toISOString() ?? row.snapshot_departure_start.toISOString(),
        pickupAt: row.current_pickup_at?.toISOString() ?? row.snapshot_pickup_at.toISOString(),
        estimatedShare: row.current_estimated_share ?? row.snapshot_estimated_share,
      },
      lateCancellation: row.late_cancellation,
      lockedShare: row.locked_share,
      history: events.rows
        .filter((event) => event.request_id === row.id)
        .map((event) => ({
          from: event.from_status,
          to: event.to_status,
          reasonCode: event.reason_code,
          details: event.details,
          at: event.created_at.toISOString(),
        })),
    })),
  });
}

const errorByKind: Record<string, { status: number; error: string }> = {
  not_found: { status: 404, error: 'Ride not found.' },
  not_owner: { status: 403, error: 'Only the ride owner can do that.' },
  not_rider: { status: 403, error: 'This action is not available to this account.' },
  suspended: { status: 403, error: 'Your account is suspended and cannot request a seat.' },
  ride_closed: { status: 409, error: 'This ride is no longer open for requests.' },
  ride_locked: { status: 409, error: 'This ride has reached its lock time.' },
  ride_full: { status: 409, error: 'This ride has no available seats.' },
  invalid_pickup: { status: 400, error: 'Choose an active campus pickup point.' },
  pickup_estimate_unavailable: {
    status: 409,
    error: 'A pickup-time estimate is unavailable for this route.',
  },
  already_requested: { status: 409, error: 'You already have a request or seat on this ride.' },
  active_request_limit: {
    status: 409,
    error: 'You can have at most three requests waiting for an owner decision.',
  },
  departure_conflict: {
    status: 409,
    error: 'This ride departs within two hours of another ride you offered or joined.',
  },
  payment_overdue: {
    status: 409,
    error:
      'Settle ride shares that have been due for more than seven days before requesting another seat.',
  },
};

export async function POST(req: Request, ctx: RequestRouteContext) {
  const blocked = await guard('request-ride-seat', 20, 900);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);
  const parsed = parseJoinRequestInput(await readJson(req));
  if (!parsed.ok) return json({ error: parsed.error, code: 'invalid_request' }, 400);

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await submitJoinRequest(
      client,
      id,
      user.id,
      parsed.value.pickupLocationId,
      parsed.value.idempotencyKey,
      new Date(),
    );
    if (result.kind !== 'created' && result.kind !== 'existing') {
      if (result.kind === 'ride_locked') await client.query('COMMIT');
      else await client.query('ROLLBACK');
      const detail = 'detail' in result ? result.detail : undefined;
      const failure = errorByKind[result.kind] ?? {
        status: 409,
        error: detail ?? 'The request could not be completed.',
      };
      return json({ error: failure.error, code: result.kind }, failure.status);
    }
    await client.query('COMMIT');
    return json({ request: result }, result.kind === 'created' ? 201 : 200);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Submit ride request failed:', error);
    return json({ error: 'Unable to submit the request right now.', code: 'server_error' }, 500);
  } finally {
    client?.release();
  }
}
