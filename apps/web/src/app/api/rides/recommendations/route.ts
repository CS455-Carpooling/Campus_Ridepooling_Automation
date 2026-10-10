import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { getRideRecommendations } from '@/lib/ai/recommendations';
import type { SearchRideRequest } from '@/lib/ride-search';

const VALID_DIRECTIONS = new Set(['to_hub', 'from_hub']);
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
    const recommendations = await getRideRecommendations(user.id, filters);
    return json(recommendations);
  } catch (error) {
    console.error('Ride recommendations failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Unable to generate ride recommendations right now.' }, 500);
  }
}
