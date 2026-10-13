import type { PoolClient } from 'pg';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { cancelRideForOwner, editRideForOwner, type RideEdit } from '@/lib/join-requests';

function optionalDate(value: unknown): Date | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/rides/[id]'>) {
  const blocked = await guard('manage-ride', 20, 900);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);
  const body = await readJson(req);
  const action = body.action;
  let edit: RideEdit = {};

  if (action === 'edit') {
    const departureStart = optionalDate(body.departureStart);
    const departureEnd = optionalDate(body.departureEnd);
    if (departureStart === null || departureEnd === null) {
      return json({ error: 'Enter a valid departure window.', code: 'invalid_departure' }, 400);
    }
    if (
      body.capacity !== undefined &&
      (!Number.isInteger(body.capacity) || Number(body.capacity) < 1)
    ) {
      return json(
        { error: 'Capacity must be a positive whole number.', code: 'invalid_capacity' },
        400,
      );
    }
    if (
      body.expectedTotalFare !== undefined &&
      (!Number.isInteger(body.expectedTotalFare) ||
        Number(body.expectedTotalFare) < 1 ||
        Number(body.expectedTotalFare) > 50_000)
    ) {
      return json(
        { error: 'Fare must be a whole number between ₹1 and ₹50,000.', code: 'invalid_fare' },
        400,
      );
    }
    if (
      body.direction !== undefined &&
      body.direction !== 'to_hub' &&
      body.direction !== 'from_hub'
    ) {
      return json({ error: 'Choose a valid ride direction.', code: 'invalid_direction' }, 400);
    }
    if (body.hubId !== undefined && (typeof body.hubId !== 'string' || body.hubId.length > 100)) {
      return json({ error: 'Choose a valid destination.', code: 'invalid_destination' }, 400);
    }
    if (
      body.confirmAffectedRiders !== undefined &&
      typeof body.confirmAffectedRiders !== 'boolean'
    ) {
      return json(
        { error: 'The rider-change confirmation is invalid.', code: 'invalid_confirmation' },
        400,
      );
    }
    edit = {
      ...(departureStart ? { departureStart } : {}),
      ...(departureEnd ? { departureEnd } : {}),
      ...(typeof body.capacity === 'number' ? { capacity: body.capacity } : {}),
      ...(typeof body.expectedTotalFare === 'number'
        ? { expectedTotalFare: body.expectedTotalFare }
        : {}),
      ...(body.direction === 'to_hub' || body.direction === 'from_hub'
        ? { direction: body.direction }
        : {}),
      ...(typeof body.hubId === 'string' ? { hubId: body.hubId } : {}),
    };
  } else if (action !== 'cancel') {
    return json({ error: 'Choose edit or cancel.', code: 'invalid_action' }, 400);
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result =
      action === 'cancel'
        ? await cancelRideForOwner(client, id, user.id, new Date())
        : await editRideForOwner(
            client,
            id,
            user.id,
            edit,
            body.confirmAffectedRiders === true,
            new Date(),
          );
    if (result.kind === 'cancelled' || result.kind === 'edited') {
      await client.query('COMMIT');
      return json({ ride: { id, state: result.kind === 'cancelled' ? 'cancelled' : undefined } });
    }
    await client.query('ROLLBACK');
    const detail = 'detail' in result ? result.detail : undefined;
    const failures: Record<string, { status: number; error: string }> = {
      not_found: { status: 404, error: 'Ride not found.' },
      not_owner: { status: 403, error: 'Only the ride owner can change this ride.' },
      not_rider: { status: 403, error: 'This action is not available to this account.' },
      trip_started: { status: 409, error: 'A ride cannot be cancelled after pickup has started.' },
      window_over: {
        status: 409,
        error: "This ride's departure window is over, so it can no longer be cancelled.",
      },
      ride_closed: { status: 409, error: detail ?? 'This ride can no longer be changed.' },
      // A departure window the rules do not allow is a bad request, not a conflict.
      invalid_departure: { status: 400, error: detail ?? 'Enter a valid departure window.' },
      ride_locked: { status: 409, error: 'A locked ride cannot be edited.' },
      ride_full: { status: 409, error: detail ?? 'The requested capacity is not available.' },
      invalid_pickup: { status: 400, error: detail ?? 'Choose an active destination hub.' },
      departure_conflict: {
        status: 409,
        error: detail ?? 'The departure conflicts with another ride.',
      },
      confirmation_required: {
        status: 409,
        error: detail ?? 'Confirm changes that affect accepted riders.',
      },
    };
    const failure = failures[result.kind] ?? {
      status: 409,
      error: detail ?? 'The ride could not be changed.',
    };
    return json({ error: failure.error, code: result.kind }, failure.status);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Manage ride failed:', error);
    return json({ error: 'Unable to change the ride right now.', code: 'server_error' }, 500);
  } finally {
    client?.release();
  }
}
