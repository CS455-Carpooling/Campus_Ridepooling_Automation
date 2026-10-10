import { randomUUID } from 'node:crypto';
import { pool } from '@/lib/db';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { getRideRecommendations } from '@/lib/ai/recommendations';
import type { SearchRideRequest } from '@/lib/ride-search';

const VALID_DIRECTIONS = new Set(['to_hub', 'from_hub']);
const RIDER_HOURLY_LIMIT = 20;

async function consumeRiderQuota(userId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
    await client.query('DELETE FROM ride_recommendation_rate_events WHERE created_at <= now() - interval \'1 hour\'');
    const { rows } = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM ride_recommendation_rate_events WHERE user_id=$1 AND created_at > now() - interval \'1 hour\'',
      [userId],
    );
    if (Number(rows[0]?.count ?? 0) >= RIDER_HOURLY_LIMIT) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('INSERT INTO ride_recommendation_rate_events (request_id, user_id) VALUES ($1, $2)', [randomUUID(), userId]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function parseFilters(body: Record<string, unknown>): SearchRideRequest | null {
  const { direction, hubId, campusLocationId, departureStart, departureEnd, vehicleTypeId, maxFareShare } = body;
  if (
    typeof direction !== 'string' || !VALID_DIRECTIONS.has(direction) ||
    typeof hubId !== 'string' || !hubId.trim() ||
    typeof campusLocationId !== 'string' || !campusLocationId.trim() ||
    typeof departureStart !== 'string' || !ISO_WITH_OFFSET.test(departureStart) ||
    typeof departureEnd !== 'string' || !ISO_WITH_OFFSET.test(departureEnd) ||
    !Number.isFinite(Date.parse(departureStart)) ||
    !Number.isFinite(Date.parse(departureEnd)) ||
    new Date(departureStart) >= new Date(departureEnd) ||
    (vehicleTypeId !== undefined && vehicleTypeId !== '' && typeof vehicleTypeId !== 'string') ||
    (maxFareShare !== undefined && maxFareShare !== null &&
      (typeof maxFareShare !== 'number' || !Number.isSafeInteger(maxFareShare) || maxFareShare <= 0))
  ) return null;

  return {
    direction: direction as SearchRideRequest['direction'],
    hubId,
    campusLocationId,
    departureStart,
    departureEnd,
    ...(typeof vehicleTypeId === 'string' && vehicleTypeId ? { vehicleTypeId } : {}),
    ...(typeof maxFareShare === 'number' ? { maxFareShare } : {}),
  };
}

export async function POST(req: Request) {
  const blocked = await guard('ride-recommendations', 10, 60);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const filters = parseFilters(await readJson(req));
  if (!filters) return json({ error: 'Please provide valid ride search filters.' }, 400);

  try {
    if (!(await consumeRiderQuota(user.id))) {
      return json({ error: 'You have reached the limit of 20 recommendation requests per hour.' }, 429);
    }
    const recommendations = await getRideRecommendations(user.id, filters);
    return json(recommendations);
  } catch (error) {
    console.error('Ride recommendations failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Unable to generate ride recommendations right now.' }, 500);
  }
}
