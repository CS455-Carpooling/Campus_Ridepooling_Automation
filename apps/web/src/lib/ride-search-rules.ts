/**
 * Checks the search filters in the /rides/results URL before they reach the database. The
 * URL can be edited by hand, and PostgreSQL rejects an impossible date or a number too big
 * for an integer, so unchecked values would fail the query instead of being caught here.
 * Pure functions only.
 */
import { parseTime, RIDE_RULES } from './ride-rules';
import type { SearchRideRequest } from './ride-search';

type SearchParams = Record<string, string | string[] | undefined>;

const DIRECTIONS = new Set(['to_hub', 'from_hub']);

/** A single query value; a repeated parameter counts as missing. */
function single(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The search filters from the results URL, or null when one is missing or invalid: a
 * direction, a hub and a campus place, a departure window given as ISO 8601 times with an
 * offset (the end after the start), and optionally a vehicle type and a maximum share in
 * whole rupees, no more than the largest fare a ride may have.
 */
export function parseSearchRequest(params: SearchParams): SearchRideRequest | null {
  const direction = single(params.direction);
  const hubId = single(params.hubId);
  const campusLocationId = single(params.campusLocationId);
  const departureStart = single(params.departureStart);
  const departureEnd = single(params.departureEnd);
  const vehicleTypeId = single(params.vehicleTypeId);
  const maxFareShareText = single(params.maxFareShare);

  if (!DIRECTIONS.has(direction) || !hubId || !campusLocationId) return null;

  const start = parseTime(departureStart);
  const end = parseTime(departureEnd);
  if (!start || !end || end <= start) return null;

  let maxFareShare: number | undefined;
  if (maxFareShareText) {
    const amount = Number(maxFareShareText);
    if (!Number.isInteger(amount) || amount < 1 || amount > RIDE_RULES.maxFare) return null;
    maxFareShare = amount;
  }

  return {
    direction: direction as SearchRideRequest['direction'],
    hubId,
    campusLocationId,
    departureStart,
    departureEnd,
    vehicleTypeId: vehicleTypeId || undefined,
    maxFareShare,
  };
}
