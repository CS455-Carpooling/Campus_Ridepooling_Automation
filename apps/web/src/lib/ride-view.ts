import 'server-only';
import { pool } from './db';
import { estimateShare, splitFare } from './fare';
import { isUuid } from './ids';
import type { Direction } from './ride-rules';
import {
  canViewRide,
  isLocked,
  isOpenToJoin,
  lockTime,
  rideTitle,
  type RideState,
  type ViewerRole,
} from './ride-status';

/** Someone with a seat on the ride: the owner or an accepted rider. */
export type RideOccupant = {
  /** The account's full name, its display name until profiles exist (FR-RD-02.4). */
  name: string;
  /** Their pickup point (leaving campus) or drop-off point (coming to campus). */
  campusPlace: string;
  isOwner: boolean;
  isViewer: boolean;
  /** Their share of the total fare now, in whole rupees (Table T-2). */
  share: number;
};

/**
 * One ride as the viewer may see it (FR-RD-03.6, UC-RO-04). It holds no email
 * addresses, roll numbers or user IDs, so it is safe to send to the browser.
 */
export type RideView = {
  id: string;
  direction: Direction;
  hub: { name: string; detail: string | null };
  /** ISO 8601 instants. */
  departureStart: string;
  departureEnd: string;
  lockAt: string;
  state: RideState;
  isLocked: boolean;
  /** Scheduled and not yet locked: others may still ask to join. */
  isOpen: boolean;
  /** The departure window is over (the state may still say Scheduled). */
  windowEnded: boolean;
  vehicleName: string;
  /** Everyone the vehicle carries, the owner included. */
  capacity: number;
  occupantCount: number;
  seatsLeft: number;
  totalFare: number;
  /** Owner first, then riders in the order they joined, as the fare split counts them. */
  occupants: RideOccupant[];
  viewerRole: ViewerRole;
  /** The viewer's own share, when they are on the ride. */
  viewerShare: number | null;
  /** What the viewer would pay by joining (FR-RD-08.1), when they may still ask to. */
  estimatedShare: number | null;
  /** When this was read, so the page can say how fresh the seats are (FR-RD-03.3). */
  readAt: string;
};

type RideRow = {
  id: string;
  direction: Direction;
  state: RideState;
  departure_start: Date;
  departure_end: Date;
  capacity_snapshot: number;
  expected_total_fare: number;
  hub_name: string;
  hub_detail: string | null;
  vehicle_name: string;
  viewer_is_owner: boolean;
  viewer_is_rider: boolean;
};

type OccupantRow = {
  full_name: string;
  campus_place: string;
  is_owner: boolean;
  is_viewer: boolean;
};

// Inactive hubs and vehicle types still show: they were valid when the ride was offered.
const RIDE_SQL = `
  SELECT r.id, r.direction, r.state, r.departure_start, r.departure_end,
         r.capacity_snapshot, r.expected_total_fare,
         hub.name AS hub_name, hub.detail AS hub_detail, v.name AS vehicle_name,
         (r.owner_id = $2) AS viewer_is_owner,
         EXISTS (SELECT 1 FROM riders m WHERE m.ride_id = r.id AND m.user_id = $2) AS viewer_is_rider
  FROM rides r
  JOIN locations hub ON hub.id = r.hub_id
  JOIN vehicle_types v ON v.id = r.vehicle_type_id
  WHERE r.id = $1`;

// Names and places only: never email, roll number or password hash (FR-RD-02.4).
const OCCUPANTS_SQL = `
  SELECT u.full_name, place.name AS campus_place,
         (m.user_id = r.owner_id) AS is_owner, (m.user_id = $2) AS is_viewer
  FROM riders m
  JOIN rides r ON r.id = m.ride_id
  JOIN users u ON u.id = m.user_id
  JOIN locations place ON place.id = m.campus_location_id
  WHERE m.ride_id = $1
  ORDER BY (m.user_id = r.owner_id) DESC, m.joined_at, m.id`;

/**
 * The ride with this ID as `viewerId` may see it, or null when it does not
 * exist or they may not see it (canViewRide), so the page can answer "not
 * found" either way without revealing which. IDs that are not UUIDs, such as
 * a mistyped link or the development user, return null without a query.
 */
export async function getRideView(
  rideId: string,
  viewerId: string,
  now: Date = new Date(),
): Promise<RideView | null> {
  if (!isUuid(rideId) || !isUuid(viewerId)) return null;

  const { rows } = await pool.query<RideRow>(RIDE_SQL, [rideId, viewerId]);
  const ride = rows[0];
  if (!ride) return null;

  const viewerRole: ViewerRole = ride.viewer_is_owner
    ? 'owner'
    : ride.viewer_is_rider
      ? 'rider'
      : 'visitor';
  if (!canViewRide(viewerRole, ride.state, ride.departure_start, now)) return null;

  const { rows: people } = await pool.query<OccupantRow>(OCCUPANTS_SQL, [rideId, viewerId]);
  const totalFare = ride.expected_total_fare;
  const shares = people.length > 0 ? splitFare(totalFare, people.length) : [];
  const occupants = people.map((person, index) => ({
    name: person.full_name,
    campusPlace: person.campus_place,
    isOwner: person.is_owner,
    isViewer: person.is_viewer,
    share: shares[index],
  }));

  const seatsLeft = Math.max(ride.capacity_snapshot - people.length, 0);
  const isOpen = isOpenToJoin(ride.state, ride.departure_start, now);
  const canAskToJoin = viewerRole === 'visitor' && isOpen && seatsLeft > 0;

  return {
    id: ride.id,
    direction: ride.direction,
    hub: { name: ride.hub_name, detail: ride.hub_detail },
    departureStart: ride.departure_start.toISOString(),
    departureEnd: ride.departure_end.toISOString(),
    lockAt: lockTime(ride.departure_start).toISOString(),
    state: ride.state,
    isLocked: isLocked(ride.departure_start, now),
    isOpen,
    windowEnded: now.getTime() >= ride.departure_end.getTime(),
    vehicleName: ride.vehicle_name,
    capacity: ride.capacity_snapshot,
    occupantCount: people.length,
    seatsLeft,
    totalFare,
    occupants,
    viewerRole,
    viewerShare: occupants.find((person) => person.isViewer)?.share ?? null,
    estimatedShare: canAskToJoin
      ? people.length > 0
        ? estimateShare(totalFare, people.length)
        : totalFare
      : null,
    readAt: now.toISOString(),
  };
}

/** A ride on the viewer's home page: one they offered or one they joined (FR-RD-06.4). */
export type UpcomingRide = {
  rideId: string;
  /** "To Kanpur Central" or "From Kanpur Central". */
  title: string;
  /** ISO 8601: the start of the departure window. */
  departure: string;
  part: 'rider' | 'owner';
  seatsLeft: number;
  state: RideState;
};

type UpcomingRow = {
  id: string;
  direction: Direction;
  hub_name: string;
  departure_start: Date;
  state: RideState;
  is_owner: boolean;
  seats_left: number;
};

/** The most rides the home page lists. */
export const UPCOMING_LIMIT = 20;

// A ride is upcoming while under way, or while scheduled and its window is not over:
// nothing moves rides out of 'scheduled' yet, so the time keeps old rides out of the list.
const UPCOMING_SQL = `
  SELECT r.id, r.direction, hub.name AS hub_name, r.departure_start, r.state,
         (r.owner_id = $1) AS is_owner,
         GREATEST(r.capacity_snapshot
           - (SELECT COUNT(*)::int FROM riders o WHERE o.ride_id = r.id), 0) AS seats_left
  FROM riders me
  JOIN rides r ON r.id = me.ride_id
  JOIN locations hub ON hub.id = r.hub_id
  WHERE me.user_id = $1
    AND (r.state IN ('pickup_in_progress', 'in_transit')
         OR (r.state = 'scheduled' AND r.departure_end > $2))
  ORDER BY r.departure_start, r.id
  LIMIT $3`;

/**
 * The rides `userId` offered or joined that have not happened yet, soonest
 * first. The owner has a riders row too, so one query covers both. A user ID
 * that is not a UUID (the development user) has no rides.
 */
export async function getUpcomingRides(
  userId: string,
  now: Date = new Date(),
): Promise<UpcomingRide[]> {
  if (!isUuid(userId)) return [];
  const { rows } = await pool.query<UpcomingRow>(UPCOMING_SQL, [userId, now, UPCOMING_LIMIT]);
  return rows.map((row) => ({
    rideId: row.id,
    title: rideTitle(row.direction, row.hub_name),
    departure: row.departure_start.toISOString(),
    part: row.is_owner ? 'owner' : 'rider',
    seatsLeft: row.seats_left,
    state: row.state,
  }));
}
