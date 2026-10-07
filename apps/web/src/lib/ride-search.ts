import 'server-only';
import { pool } from './db';
import { estimateShare } from './fare';
import { isUuid } from './ids';
import type { Direction } from './ride-rules';

export type SearchRideRequest = {
  direction: 'to_hub' | 'from_hub';
  hubId: string;
  campusLocationId: string;
  departureStart: string;
  departureEnd: string;
  vehicleTypeId?: string;
  maxFareShare?: number;
};

export type SearchRideResult = {
  id: string;
  direction: Direction;
  ownerName: string;
  /** Display names of all current occupants (owner first, then riders). */
  occupantNames: string[];
  hub: { name: string; detail: string | null };
  /** The owner's campus pickup or drop-off point. */
  campusLocationName: string;
  departureStart: string;
  departureEnd: string;
  vehicleName: string;
  capacity: number;
  occupantCount: number;
  seatsLeft: number;
  totalFare: number;
  /** ceil(totalFare / (occupantCount + 1)) — what the viewer would pay by joining. */
  estimatedShare: number;
};

type SearchRow = {
  id: string;
  direction: Direction;
  hub_name: string;
  hub_detail: string | null;
  campus_location_name: string;
  departure_start: Date;
  departure_end: Date;
  vehicle_name: string;
  capacity_snapshot: number;
  occupant_count: number;
  seats_left: number;
  expected_total_fare: number;
  owner_name: string;
};

type OccupantNameRow = {
  ride_id: string;
  display_name: string;
  is_owner: boolean;
};

// Lock threshold: 60 minutes, matching RIDE_RULES.minLeadMinutes in ride-rules.ts.
const SEARCH_SQL = `
  SELECT
    r.id,
    r.direction,
    hub.name            AS hub_name,
    hub.detail          AS hub_detail,
    campus.name         AS campus_location_name,
    r.departure_start,
    r.departure_end,
    vt.name             AS vehicle_name,
    r.capacity_snapshot,
    r.expected_total_fare,
    (SELECT COUNT(*)::int FROM riders o WHERE o.ride_id = r.id) AS occupant_count,
    GREATEST(
      r.capacity_snapshot
        - (SELECT COUNT(*)::int FROM riders o WHERE o.ride_id = r.id),
      0
    ) AS seats_left,
    COALESCE(owner_profile.display_name, owner_user.full_name) AS owner_name
  FROM rides r
  JOIN locations   hub      ON hub.id      = r.hub_id
  JOIN vehicle_types vt     ON vt.id       = r.vehicle_type_id
  JOIN users        owner_user    ON owner_user.id = r.owner_id
  LEFT JOIN user_profiles owner_profile ON owner_profile.user_id = r.owner_id
  -- The owner's campus place comes from their riders row (owner always has one).
  JOIN riders       owner_rider ON owner_rider.ride_id = r.id
                               AND owner_rider.user_id = r.owner_id
  JOIN locations    campus      ON campus.id = owner_rider.campus_location_id
  WHERE
    r.direction = $1
    AND r.hub_id = $2
    AND r.state = 'scheduled'
    -- Only rides that have not locked yet (departure > now + 60 min).
    AND r.departure_start > NOW() + INTERVAL '60 minutes'
    -- Departure window overlaps the requested window.
    AND r.departure_start < $4
    AND r.departure_end   > $3
    -- Exclude rides the viewer owns or has already joined.
    AND r.owner_id <> $5
    AND NOT EXISTS (
      SELECT 1 FROM riders m WHERE m.ride_id = r.id AND m.user_id = $5
    )
    -- Must have at least one seat left.
    AND r.capacity_snapshot
          - (SELECT COUNT(*)::int FROM riders o WHERE o.ride_id = r.id) > 0
    -- Optional vehicle type filter.
    AND ($6::text IS NULL OR r.vehicle_type_id = $6::text)
    -- Optional max fare-share filter: estimated share <= the user's limit.
    AND (
      $7::int IS NULL
      OR CEIL(
           r.expected_total_fare::numeric
           / (
               (SELECT COUNT(*)::int FROM riders o WHERE o.ride_id = r.id) + 2
             )
         ) <= $7::int
    )
  ORDER BY r.departure_start, r.id
  LIMIT 50`;

// Fetches display names for all occupants of the given ride IDs in one query.
const OCCUPANT_NAMES_SQL = `
  SELECT
    m.ride_id,
    COALESCE(p.display_name, u.full_name) AS display_name,
    (m.user_id = r.owner_id) AS is_owner
  FROM riders m
  JOIN rides r ON r.id = m.ride_id
  JOIN users  u ON u.id = m.user_id
  LEFT JOIN user_profiles p ON p.user_id = u.id
  WHERE m.ride_id = ANY($1::uuid[])
  ORDER BY m.ride_id, (m.user_id = r.owner_id) DESC, m.joined_at, m.id`;

/**
 * Searches for open, unlocked rides matching the given filters as seen by
 * `viewerId`. Excludes rides the viewer already belongs to, rides that have
 * locked, and full rides. IDs that are not UUIDs return an empty array.
 */
export async function searchRides(
  viewerId: string,
  filters: SearchRideRequest,
  _now: Date = new Date(),
): Promise<SearchRideResult[]> {
  if (!isUuid(viewerId)) return [];

  const { rows } = await pool.query<SearchRow>(SEARCH_SQL, [
    filters.direction,
    filters.hubId,
    filters.departureStart,
    filters.departureEnd,
    viewerId,
    filters.vehicleTypeId ?? null,
    filters.maxFareShare ?? null,
  ]);

  if (rows.length === 0) return [];

  const rideIds = rows.map((r) => r.id);
  const { rows: occupantRows } = await pool.query<OccupantNameRow>(OCCUPANT_NAMES_SQL, [rideIds]);

  // Group names by ride ID: owner first (SQL orders them), then riders.
  const namesByRide = new Map<string, string[]>();
  for (const row of occupantRows) {
    const list = namesByRide.get(row.ride_id) ?? [];
    list.push(row.display_name);
    namesByRide.set(row.ride_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    ownerName: row.owner_name,
    occupantNames: namesByRide.get(row.id) ?? [row.owner_name],
    hub: { name: row.hub_name, detail: row.hub_detail },
    campusLocationName: row.campus_location_name,
    departureStart: row.departure_start.toISOString(),
    departureEnd: row.departure_end.toISOString(),
    vehicleName: row.vehicle_name,
    capacity: row.capacity_snapshot,
    occupantCount: row.occupant_count,
    seatsLeft: row.seats_left,
    totalFare: row.expected_total_fare,
    estimatedShare:
      row.occupant_count > 0
        ? estimateShare(row.expected_total_fare, row.occupant_count)
        : row.expected_total_fare,
  }));
}
