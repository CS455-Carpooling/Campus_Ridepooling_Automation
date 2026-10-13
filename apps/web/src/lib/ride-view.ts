import 'server-only';
import { pool } from './db';
import { estimateShare } from './fare';
import { complaintWindow } from './complaint-rules';
import { isUuid } from './ids';
import { ratingClosesAt, ratingWindow, type PublicRating, type RatingWindow } from './rating-rules';
import { publicRatingJoin } from './rating-summary';
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
import type { SosIncident } from './sos';
import { canRaiseSos } from './sos-rules';
import { AGREED_PICKUP_SQL, activeShares } from './trip';
import { pickupTimeFor, tripItinerary } from './trip-itinerary';
import {
  checkInRefusal,
  isActiveSeat,
  noShowAvailableAt,
  seatStatus,
  tripTransitionRefusal,
  type SeatStatus,
  type TripTarget,
} from './trip-rules';

/** Someone with a seat on the ride: the owner or an accepted rider. People who left are not listed. */
export type RideOccupant = {
  /** Their seat (riders.id), which the trip actions name; never their account ID. */
  occupantId: string;
  /** The public display name from their profile (FR-RD-02.4). */
  name: string;
  /** Their pickup point (leaving campus) or drop-off point (coming to campus). */
  campusPlace: string;
  isOwner: boolean;
  isViewer: boolean;
  /** Only tags the rider chose to make visible (FR-RD-02.4). */
  visibleTags: string[];
  completedTrips: number;
  /**
   * Their share of the total fare now, in whole rupees (Table T-2), or null for a no-show, who
   * leaves the pool and owes nothing (FR-RO-10.2).
   */
  share: number | null;
  /** Their average from released ratings, or null below 3 ratings (P-24, CS455-44). */
  rating: PublicRating | null;
  /** Where they stand at pickup (FR-RO-09.3, FR-RD-10.4). */
  status: SeatStatus;
  /**
   * For the owner while pickup is in progress: when this rider may be marked a no-show, 5 minutes
   * after their estimated pickup time (P-19). Null for everyone else, and once they arrived or
   * were marked a no-show.
   */
  noShowAvailableAt: string | null;
};

/** One stop on the trip and the people who get in (or out) there. */
export type TripStop = {
  place: string;
  /** An estimate from the campus travel times, or null when there is none. */
  estimatedAt: string | null;
  /** The seats (riders.id) that stop here, and the names of the people in them, in seat order. */
  occupantIds: string[];
  people: string[];
};

/** The trip as the people on the ride follow it (CS455-63: FR-RO-09, FR-RD-10). */
export type TripView = {
  pickupStartedAt: string | null;
  tripStartedAt: string | null;
  /** Pickups in order leaving campus; drop-offs in order coming to campus (FR-RD-10.2). */
  stopKind: 'pickup' | 'drop_off';
  stops: TripStop[];
  /** The viewer's own estimated pickup time, when they are a rider leaving campus. */
  viewerPickupAt: string | null;
  /** The owner may start pickup now: the ride is locked and still scheduled (FR-RO-09.1). */
  canStartPickup: boolean;
  /** The owner may say the trip has left the last pickup point (FR-RD-10.1). */
  canStartTrip: boolean;
  /** The viewer may say they are at their pickup point now (FR-RD-10.4). */
  canCheckIn: boolean;
  /** The viewer was marked a no-show on this ride (FR-RD-10.3). */
  viewerNoShow: boolean;
  /** The viewer may raise an SOS now: they are active in the pool and the trip is under way. */
  canRaiseSos: boolean;
  /** The viewer's own alert on this ride, while it is not closed; never anyone else's (FR-RD-15.4). */
  viewerSos: SosIncident | null;
};

/**
 * One ride as the viewer may see it (FR-RD-03.6, UC-RO-04). It holds no email
 * addresses, roll numbers or user IDs, so it is safe to send to the browser.
 */
export type RideView = {
  id: string;
  direction: Direction;
  hubId: string;
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
  /** ISO 8601: when the owner marked the ride completed, or null while it is not. */
  completedAt: string | null;
  /** The viewer is the owner and may mark the ride completed now (FR-RO-09.4). */
  canComplete: boolean;
  /** The trip, for the people on the ride; null for anyone else. */
  trip: TripView | null;
  /**
   * Someone on the ride may report a problem with the trip now (CS455-53, FR-RD-13.1): it was
   * completed less than 7 days ago and has someone else on it.
   */
  canComplain: boolean;
  /**
   * Rating on a completed ride, for the people on it (CS455-43): whether it is
   * open, until when, and how many of the others the viewer has not rated yet.
   * Null for anyone else and for rides that are not completed.
   */
  review: { window: RatingWindow; closesAt: string; leftToRate: number } | null;
  vehicleName: string;
  /** Everyone the vehicle carries, the owner included. */
  capacity: number;
  /** The people the fare is split between: everyone listed except no-shows. */
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
  hub_id: string;
  state: RideState;
  departure_start: Date;
  departure_end: Date;
  completed_at: Date | null;
  locked_at: Date | null;
  pickup_started_at: Date | null;
  trip_started_at: Date | null;
  capacity_snapshot: number;
  expected_total_fare: number;
  hub_name: string;
  hub_detail: string | null;
  vehicle_name: string;
  viewer_is_owner: boolean;
  viewer_is_rider: boolean;
  viewer_ratings_given: number;
  viewer_sos: {
    id: string;
    reference: string;
    raised_at: string;
    status: SosIncident['status'];
    location_shared: boolean;
    false_alarm: boolean;
  } | null;
};

type OccupantRow = {
  occupant_id: string;
  full_name: string;
  campus_place: string;
  is_owner: boolean;
  is_viewer: boolean;
  visible_tags: string[] | null;
  completed_trips: number;
  rating_count: number | null;
  rating_average: number | null;
  locked_share: number | null;
  checked_in_at: Date | null;
  arrived_at: Date | null;
  no_show_at: Date | null;
  agreed_pickup_at: Date | null;
};

// Inactive hubs and vehicle types still show: they were valid when the ride was offered.
const RIDE_SQL = `
  SELECT r.id, r.direction, r.state, r.departure_start, r.departure_end, r.completed_at, r.locked_at,
         r.pickup_started_at, r.trip_started_at, r.capacity_snapshot, r.expected_total_fare,
         hub.id AS hub_id, hub.name AS hub_name, hub.detail AS hub_detail, v.name AS vehicle_name,
         (r.owner_id = $2) AS viewer_is_owner,
         EXISTS (SELECT 1 FROM riders m
                 WHERE m.ride_id = r.id AND m.user_id = $2 AND m.left_at IS NULL) AS viewer_is_rider,
         (SELECT count(*)::int FROM ride_ratings given
          WHERE given.ride_id = r.id AND given.rater_id = $2) AS viewer_ratings_given,
         -- The viewer's own SOS only (raised_by = the viewer): nobody else's is ever read here.
         (SELECT json_build_object('id', s.id, 'reference', s.reference, 'raised_at', s.raised_at,
                                   'status', s.status, 'location_shared', s.located_at IS NOT NULL,
                                   'false_alarm', s.false_alarm_at IS NOT NULL)
          FROM sos_incidents s
          WHERE s.ride_id = r.id AND s.raised_by = $2 AND s.status <> 'closed'
          ORDER BY s.raised_at DESC LIMIT 1) AS viewer_sos
  FROM rides r
  JOIN locations hub ON hub.id = r.hub_id
  JOIN vehicle_types v ON v.id = r.vehicle_type_id
  WHERE r.id = $1`;

// Names and places only: never email, roll number or password hash (FR-RD-02.4). People who
// left are not on the ride any more; no-shows stay listed, marked as such.
const OCCUPANTS_SQL = `
  SELECT m.id AS occupant_id, COALESCE(profile.display_name, u.full_name) AS full_name,
         place.name AS campus_place,
         (m.user_id = r.owner_id) AS is_owner, (m.user_id = $2) AS is_viewer,
         COALESCE(public_tags.visible_tags, ARRAY[]::text[]) AS visible_tags,
         (SELECT count(DISTINCT completed.ride_id)::int
          FROM riders completed
          JOIN rides completed_ride ON completed_ride.id = completed.ride_id
          WHERE completed.user_id = m.user_id AND completed.left_at IS NULL
            AND completed.no_show_at IS NULL AND completed_ride.state = 'completed')
           AS completed_trips,
         public_rating.rating_count, public_rating.rating_average,
         m.locked_share, m.checked_in_at, m.arrived_at, m.no_show_at,
         ${AGREED_PICKUP_SQL} AS agreed_pickup_at
  FROM riders m
  JOIN rides r ON r.id = m.ride_id
  JOIN users u ON u.id = m.user_id
  LEFT JOIN user_profiles profile ON profile.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT array_agg(tag.name ORDER BY tag.name) AS visible_tags
    FROM user_profile_tags selected
    JOIN interest_tags tag ON tag.id = selected.tag_id AND tag.is_active = true
    WHERE selected.user_id = m.user_id AND selected.is_visible = true
  ) public_tags ON true
  ${publicRatingJoin('m.user_id', '$3')}
  JOIN locations place ON place.id = m.campus_location_id
  WHERE m.ride_id = $1 AND m.left_at IS NULL
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
  if (
    !canViewRide(viewerRole, ride.state, ride.departure_start, now) ||
    (viewerRole === 'visitor' && ride.locked_at !== null)
  )
    return null;

  const { rows: people } = await pool.query<OccupantRow>(OCCUPANTS_SQL, [rideId, viewerId, now]);
  const totalFare = ride.expected_total_fare;
  const shares = activeShares(
    people.map((person) => ({
      leftAt: null,
      noShowAt: person.no_show_at,
      lockedShare: person.locked_share,
    })),
    totalFare,
  );
  const activeCount = shares.filter((share) => share !== null).length;
  const itinerary = tripItinerary(
    ride.direction,
    ride.departure_start,
    people
      .filter((person) => isActiveSeat({ leftAt: null, noShowAt: person.no_show_at }))
      .map((person) => ({
        seatId: person.occupant_id,
        place: person.campus_place,
        isOwner: person.is_owner,
      })),
  );
  // For the owner during pickup, each rider still to be decided gets the time a no-show becomes
  // possible: 5 minutes after their estimated pickup time (P-19).
  const noShowFrom = (person: OccupantRow) =>
    viewerRole === 'owner' &&
    ride.state === 'pickup_in_progress' &&
    !person.is_owner &&
    !person.no_show_at &&
    !person.arrived_at
      ? noShowAvailableAt(
          person.agreed_pickup_at ??
            pickupTimeFor(itinerary, person.occupant_id, ride.departure_start),
        ).toISOString()
      : null;

  const occupants = people.map((person, index): RideOccupant => ({
    occupantId: person.occupant_id,
    name: person.full_name,
    campusPlace: person.campus_place,
    isOwner: person.is_owner,
    isViewer: person.is_viewer,
    visibleTags: person.visible_tags ?? [],
    completedTrips: person.completed_trips ?? 0,
    share: shares[index],
    rating:
      person.rating_count !== null && person.rating_average !== null
        ? { average: person.rating_average, count: person.rating_count }
        : null,
    status: seatStatus({
      leftAt: null,
      checkedInAt: person.checked_in_at,
      arrivedAt: person.arrived_at,
      noShowAt: person.no_show_at,
    }),
    noShowAvailableAt: noShowFrom(person),
  }));

  const seatsLeft = Math.max(ride.capacity_snapshot - people.length, 0);
  const isOpen = ride.locked_at === null && isOpenToJoin(ride.state, ride.departure_start, now);
  const rating = ratingWindow(ride.state, ride.completed_at, now);
  const canAskToJoin = viewerRole === 'visitor' && isOpen && seatsLeft > 0;
  const viewerRow = people.find((person) => person.is_viewer);
  const viewerNoShow = Boolean(viewerRow?.no_show_at);
  const canMoveTo = (to: TripTarget) =>
    ride.state !== to &&
    tripTransitionRefusal(
      viewerRole,
      ride.state,
      to,
      ride.departure_start,
      now,
      ride.locked_at,
      ride.departure_end,
    ) === null;
  const nameOf = (seatId: string) =>
    people.find((person) => person.occupant_id === seatId)?.full_name ?? '';
  const viewerStop = viewerRow
    ? itinerary.stops.find((stop) => stop.seatIds.includes(viewerRow.occupant_id))
    : undefined;

  const trip: TripView | null =
    viewerRole === 'visitor'
      ? null
      : {
          pickupStartedAt: ride.pickup_started_at ? ride.pickup_started_at.toISOString() : null,
          tripStartedAt: ride.trip_started_at ? ride.trip_started_at.toISOString() : null,
          stopKind: itinerary.kind,
          stops: itinerary.stops.map((stop) => ({
            place: stop.place,
            estimatedAt: stop.estimatedAt ? stop.estimatedAt.toISOString() : null,
            occupantIds: stop.seatIds,
            people: stop.seatIds.map(nameOf),
          })),
          viewerPickupAt:
            viewerRow && !viewerRow.is_owner && viewerStop?.estimatedAt
              ? viewerStop.estimatedAt.toISOString()
              : null,
          canStartPickup: canMoveTo('pickup_in_progress'),
          canStartTrip: canMoveTo('in_transit'),
          canCheckIn:
            !!viewerRow &&
            !viewerRow.checked_in_at &&
            checkInRefusal(
              ride.state,
              ride.departure_start,
              now,
              { isOwner: viewerRow.is_owner, leftAt: null, noShowAt: viewerRow.no_show_at },
              ride.locked_at,
            ) === null,
          viewerNoShow,
          canRaiseSos: canRaiseSos(
            ride.state,
            viewerRow !== undefined &&
              isActiveSeat({ leftAt: null, noShowAt: viewerRow.no_show_at }),
          ),
          viewerSos: ride.viewer_sos
            ? {
                id: ride.viewer_sos.id,
                reference: ride.viewer_sos.reference,
                raisedAt: new Date(ride.viewer_sos.raised_at).toISOString(),
                status: ride.viewer_sos.status,
                locationShared: ride.viewer_sos.location_shared,
                falseAlarm: ride.viewer_sos.false_alarm,
              }
            : null,
        };

  return {
    id: ride.id,
    direction: ride.direction,
    hubId: ride.hub_id,
    hub: { name: ride.hub_name, detail: ride.hub_detail },
    departureStart: ride.departure_start.toISOString(),
    departureEnd: ride.departure_end.toISOString(),
    lockAt: lockTime(ride.departure_start).toISOString(),
    state: ride.state,
    isLocked: ride.locked_at !== null || isLocked(ride.departure_start, now),
    isOpen,
    windowEnded: now.getTime() >= ride.departure_end.getTime(),
    completedAt: ride.completed_at ? ride.completed_at.toISOString() : null,
    canComplete: canMoveTo('completed'),
    trip,
    canComplain:
      viewerRole !== 'visitor' &&
      people.length > 1 &&
      complaintWindow(ride.state, ride.completed_at, now, viewerRow?.no_show_at ?? null) === 'open',
    review:
      viewerRole !== 'visitor' &&
      !viewerNoShow &&
      ride.completed_at &&
      (rating === 'open' || rating === 'closed')
        ? {
            window: rating,
            closesAt: ratingClosesAt(ride.completed_at).toISOString(),
            leftToRate: Math.max(activeCount - 1 - (ride.viewer_ratings_given ?? 0), 0),
          }
        : null,
    vehicleName: ride.vehicle_name,
    capacity: ride.capacity_snapshot,
    occupantCount: activeCount,
    seatsLeft,
    totalFare,
    occupants,
    viewerRole,
    viewerShare: occupants.find((person) => person.isViewer)?.share ?? null,
    estimatedShare: canAskToJoin
      ? activeCount > 0
        ? estimateShare(totalFare, activeCount)
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

/** A past ride the viewer offered or joined, with the trip details for their history. */
export type HistoricalRide = {
  rideId: string;
  title: string;
  departureStart: string;
  departureEnd: string;
  part: 'rider' | 'owner';
  campusPlace: string;
  direction: Direction;
  vehicleName: string;
  totalFare: number;
  capacity: number;
  occupantCount: number;
  state: RideState;
  /** ISO 8601: when the ride was marked completed, or null. */
  completedAt: string | null;
  /** How many of the others on the ride the viewer has rated (FR-RD-16.1, CS455-44). */
  ratingsGiven: number;
  /** When rating closes on a completed ride, or null. */
  ratingClosesAt: string | null;
  /** Rating is open and someone else on the ride is still unrated by the viewer. */
  canRate: boolean;
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
           - (SELECT COUNT(*)::int FROM riders o
              WHERE o.ride_id = r.id AND o.left_at IS NULL), 0) AS seats_left
  FROM riders me
  JOIN rides r ON r.id = me.ride_id
  JOIN locations hub ON hub.id = r.hub_id
  WHERE me.user_id = $1
    AND me.left_at IS NULL
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

type HistoricalRow = {
  id: string;
  direction: Direction;
  hub_name: string;
  departure_start: Date;
  departure_end: Date;
  state: RideState;
  is_owner: boolean;
  campus_place: string;
  vehicle_name: string;
  total_fare: number;
  capacity: number;
  occupant_count: number;
  completed_at: Date | null;
  ratings_given: number;
  viewer_no_show_at: Date | null;
  viewer_left_at: Date | null;
};

const HISTORY_SQL = `
  SELECT r.id, r.direction, hub.name AS hub_name, r.departure_start, r.departure_end,
         r.state, (r.owner_id = $1) AS is_owner, place.name AS campus_place,
         vehicle.name AS vehicle_name, r.expected_total_fare AS total_fare,
         r.capacity_snapshot AS capacity,
         (SELECT COUNT(*)::int FROM riders occupants
          WHERE occupants.ride_id = r.id AND occupants.left_at IS NULL
            AND occupants.no_show_at IS NULL) AS occupant_count,
         me.no_show_at AS viewer_no_show_at, me.left_at AS viewer_left_at,
         r.completed_at,
         (SELECT count(*)::int FROM ride_ratings given
          WHERE given.ride_id = r.id AND given.rater_id = $1) AS ratings_given
  FROM riders me
  JOIN rides r ON r.id = me.ride_id
  JOIN locations hub ON hub.id = r.hub_id
  JOIN locations place ON place.id = me.campus_location_id
  JOIN vehicle_types vehicle ON vehicle.id = r.vehicle_type_id
  WHERE me.user_id = $1
    AND (r.state IN ('completed', 'cancelled')
         OR (r.state = 'scheduled' AND r.departure_end <= $2))
  ORDER BY r.departure_start DESC, r.id DESC`;

/** All completed, cancelled, and elapsed scheduled rides the user offered or joined. */
export async function getHistoricalRides(
  userId: string,
  now: Date = new Date(),
): Promise<HistoricalRide[]> {
  if (!isUuid(userId)) return [];
  const { rows } = await pool.query<HistoricalRow>(HISTORY_SQL, [userId, now]);
  return rows.map((row) => ({
    rideId: row.id,
    title: rideTitle(row.direction, row.hub_name),
    departureStart: row.departure_start.toISOString(),
    departureEnd: row.departure_end.toISOString(),
    part: row.is_owner ? 'owner' : 'rider',
    campusPlace: row.campus_place,
    direction: row.direction,
    vehicleName: row.vehicle_name,
    totalFare: row.total_fare,
    capacity: row.capacity,
    occupantCount: row.occupant_count,
    state: row.state,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    ratingsGiven: row.ratings_given ?? 0,
    ratingClosesAt: row.completed_at ? ratingClosesAt(row.completed_at).toISOString() : null,
    // Only people who were on the trip rate it (FR-RD-12.2): not a no-show, not someone who left.
    canRate:
      !row.viewer_no_show_at &&
      !row.viewer_left_at &&
      ratingWindow(row.state, row.completed_at, now) === 'open' &&
      (row.ratings_given ?? 0) < row.occupant_count - 1,
  }));
}
