import 'server-only';
import type { PoolClient } from 'pg';
import { splitFare } from './fare';
import { applyDueLock, completeAcceptedJoinRequests, markRequestNoShow } from './join-requests';
import type { Direction } from './ride-rules';
import { canViewRide, rideTitle, type RideState, type ViewerRole } from './ride-status';
import { pickupTimeFor, tripItinerary, type Itinerary } from './trip-itinerary';
import type { SosRefusal } from './sos-rules';
import {
  arrivalRefusal,
  checkInRefusal,
  isActiveSeat,
  noShowAvailableAt,
  noShowRefusal,
  tripTransitionRefusal,
  type SeatRefusal,
  type TripRefusal,
  type TripTarget,
} from './trip-rules';

/**
 * A ride under way (CS455-62: FR-RO-09, FR-RO-10, FR-RD-10): the owner starts pickup, marks
 * arrivals and no-shows, starts the trip and completes it, and riders check in at their pickup
 * point. Each function runs inside the caller's transaction on `client`, locks the ride first so
 * trip changes happen one at a time, and leaves the commit to the caller.
 */

/** What a trip change came to. A refusal names its code; the grace period also says when. */
export type TripResult<T> =
  | { kind: 'done'; value: T }
  | { kind: 'not_found' }
  | { kind: 'seat_not_found' }
  | { kind: 'refused'; code: TripRefusal | SeatRefusal | SosRefusal; availableAt?: string };

type RideRow = {
  id: string;
  owner_id: string;
  state: RideState;
  direction: Direction;
  departure_start: Date;
  departure_end: Date;
  expected_total_fare: number;
  hub_name: string;
  pickup_started_at: Date | null;
  trip_started_at: Date | null;
  completed_at: Date | null;
  locked_at: Date | null;
};

export type SeatRow = {
  id: string;
  user_id: string;
  is_owner: boolean;
  place: string;
  left_at: Date | null;
  checked_in_at: Date | null;
  arrived_at: Date | null;
  no_show_at: Date | null;
  /** The share fixed for this seat when the ride locked (CS455-75), or null before the lock. */
  locked_share: number | null;
  /** The pickup time on the rider's accepted request (CS455-75), or null without one. */
  agreed_pickup_at: Date | null;
};

const RIDE_SQL = `
  SELECT r.id, r.owner_id, r.state, r.direction, r.departure_start, r.departure_end,
         r.expected_total_fare,
         hub.name AS hub_name, r.pickup_started_at, r.trip_started_at, r.completed_at,
         r.locked_at
  FROM rides r
  JOIN locations hub ON hub.id = r.hub_id
  WHERE r.id = $1
  FOR NO KEY UPDATE OF r`;

/**
 * The pickup time a rider agreed to, from their accepted join request (CS455-75), for the seat
 * aliased `m`. The no-show grace period counts from it, so it matches what the rider was shown.
 */
export const AGREED_PICKUP_SQL = `(
  SELECT COALESCE(request.current_pickup_at, request.accepted_pickup_at)
  FROM ride_join_requests request
  WHERE request.ride_id = m.ride_id AND request.rider_id = m.user_id
    AND request.status = 'accepted'
  ORDER BY request.accepted_at DESC NULLS LAST
  LIMIT 1
)`;

// Owner first, then riders in the order they joined: the order the fare split counts them.
const SEATS_SQL = `
  SELECT m.id, m.user_id, (m.user_id = r.owner_id) AS is_owner, place.name AS place,
         m.left_at, m.checked_in_at, m.arrived_at, m.no_show_at, m.locked_share,
         ${AGREED_PICKUP_SQL} AS agreed_pickup_at
  FROM riders m
  JOIN rides r ON r.id = m.ride_id
  JOIN locations place ON place.id = m.campus_location_id
  WHERE m.ride_id = $1
  ORDER BY (m.user_id = r.owner_id) DESC, m.joined_at, m.id`;

type Trip = { ride: RideRow; seats: SeatRow[]; role: ViewerRole };

/**
 * The locked ride and its seats as `userId` sees them, or null when they may not see it, so the
 * answer is the same as for a ride that does not exist. Someone who left the ride is a visitor.
 */
async function loadTrip(
  client: PoolClient,
  rideId: string,
  userId: string,
  now: Date,
): Promise<Trip | null> {
  const ride = (await client.query<RideRow>(RIDE_SQL, [rideId])).rows[0];
  if (!ride) return null;
  const seats = (await client.query<SeatRow>(SEATS_SQL, [rideId])).rows;
  const role: ViewerRole =
    ride.owner_id === userId
      ? 'owner'
      : seats.some((seat) => seat.user_id === userId && !seat.left_at)
        ? 'rider'
        : 'visitor';
  if (!canViewRide(role, ride.state, ride.departure_start, now)) return null;
  return { ride, seats, role };
}

/** A seat as the fare split sees it. */
export type ShareSeat = {
  leftAt: Date | string | null;
  noShowAt: Date | string | null;
  /** The share fixed when the ride locked (CS455-75); null or missing before the lock. */
  lockedShare?: number | null;
};

/**
 * Each seat's share of `totalFare`, in seat order (owner first, then by joining), or null for a
 * seat that owes nothing.
 *
 * - Before the lock, the fare is split between the seats still in the pool (Table T-2).
 * - From the lock, each seat keeps the share fixed for it then (FR-RD-08.3). A rider who left
 *   after the lock still owes theirs (FR-RD-07.3). A no-show owes nothing, and their share is
 *   split again between the seats still in the pool (FR-RO-10.2), so the shares still add up.
 */
export function activeShares(
  seats: ReadonlyArray<ShareSeat>,
  totalFare: number,
): Array<number | null> {
  const locked = seats.some((seat) => typeof seat.lockedShare === 'number');
  const activeCount = seats.filter(isActiveSeat).length;

  if (!locked) {
    const shares = activeCount > 0 ? splitFare(totalFare, activeCount) : [];
    let next = 0;
    return seats.map((seat) => (isActiveSeat(seat) ? shares[next++] : null));
  }

  const spare = seats
    .filter((seat) => !seat.leftAt && seat.noShowAt)
    .reduce((sum, seat) => sum + (seat.lockedShare ?? 0), 0);
  const extra = activeCount > 0 ? splitFare(spare, activeCount) : [];
  let next = 0;
  return seats.map((seat) => {
    if (seat.leftAt) return seat.lockedShare ?? null;
    if (seat.noShowAt) return null;
    return (seat.lockedShare ?? 0) + extra[next++];
  });
}

/** The stops of this trip and when each person is picked up, from the seats still on it. */
export function itineraryFor(
  direction: Direction,
  departureStart: Date,
  seats: ReadonlyArray<Pick<SeatRow, 'id' | 'place' | 'is_owner' | 'left_at' | 'no_show_at'>>,
): Itinerary {
  return tripItinerary(
    direction,
    departureStart,
    seats
      .filter((seat) => isActiveSeat({ leftAt: seat.left_at, noShowAt: seat.no_show_at }))
      .map((seat) => ({ seatId: seat.id, place: seat.place, isOwner: seat.is_owner })),
  );
}

const asSeat = (seat: SeatRow) => ({
  isOwner: seat.is_owner,
  leftAt: seat.left_at,
  arrivedAt: seat.arrived_at,
  noShowAt: seat.no_show_at,
});

/** Tells everyone still riding, but not the owner, what happened (FR-RO-09.2, FR-RD-14.1). */
async function notifyRiders(
  client: PoolClient,
  trip: Trip,
  type: 'trip_update' | 'no_show_recorded',
  title: string,
  body: string,
  only?: string,
) {
  const recipients = only
    ? [only]
    : trip.seats
        .filter((seat) => !seat.is_owner && isActiveSeat(asSeat(seat)))
        .map((seat) => seat.user_id);
  if (recipients.length === 0) return;
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, related_ride_id)
     SELECT recipient, $2, $3, $4, $5 FROM unnest($1::uuid[]) AS recipient`,
    [recipients, type, title, body, trip.ride.id],
  );
}

export type TripState = {
  id: string;
  state: RideState;
  pickupStartedAt: string | null;
  tripStartedAt: string | null;
  completedAt: string | null;
};

const iso = (date: Date | null) => (date ? date.toISOString() : null);

const tripState = (ride: RideRow): TripState => ({
  id: ride.id,
  state: ride.state,
  pickupStartedAt: iso(ride.pickup_started_at),
  tripStartedAt: iso(ride.trip_started_at),
  completedAt: iso(ride.completed_at),
});

const stepNotices: Record<TripTarget, (title: string) => [string, string]> = {
  pickup_in_progress: (title) => [
    'Pickup has started',
    `The owner of ${title} has started pickup. Please be at your pickup point.`,
  ],
  in_transit: (title) => ['Your trip is under way', `${title} has left the last pickup point.`],
  completed: (title) => [
    'Ride completed',
    `${title} is completed. You can rate the people on it for the next 72 hours.`,
  ],
};

/**
 * Moves the ride to `to` (FR-RO-09.1, 09.4; FR-RD-10.1), for its owner only. Leaving pickup marks
 * every rider not yet marked as on board. Completing stores the final pool and shares. Asking for
 * the state the ride is already in changes nothing.
 */
export async function changeTripState(
  client: PoolClient,
  rideId: string,
  userId: string,
  to: TripTarget,
  now: Date,
): Promise<TripResult<TripState>> {
  const trip = await loadTrip(client, rideId, userId, now);
  if (!trip) return { kind: 'not_found' };
  const { ride } = trip;
  const refusal = tripTransitionRefusal(
    trip.role,
    ride.state,
    to,
    ride.departure_start,
    now,
    ride.locked_at,
    ride.departure_end,
  );
  if (refusal) return { kind: 'refused', code: refusal };
  if (ride.state === to) return { kind: 'done', value: tripState(ride) };

  // Pickup needs the lock applied: shares fixed and waiting requests expired (CS455-75).
  if (to === 'pickup_in_progress') await applyDueLock(client, ride.id, now);

  if (ride.state === 'pickup_in_progress') {
    await client.query(
      `UPDATE riders SET arrived_at = $2
       WHERE ride_id = $1 AND user_id <> $3
         AND left_at IS NULL AND no_show_at IS NULL AND arrived_at IS NULL`,
      [ride.id, now, ride.owner_id],
    );
  }

  const column = {
    pickup_in_progress: 'pickup_started_at',
    in_transit: 'trip_started_at',
    completed: 'completed_at',
  }[to];
  await client.query(`UPDATE rides SET state = $2, ${column} = $3 WHERE id = $1`, [
    ride.id,
    to,
    now,
  ]);
  const updated: RideRow = {
    ...ride,
    state: to,
    pickup_started_at: to === 'pickup_in_progress' ? now : ride.pickup_started_at,
    trip_started_at: to === 'in_transit' ? now : ride.trip_started_at,
    completed_at: to === 'completed' ? now : ride.completed_at,
  };

  if (to === 'completed') {
    const shares = activeShares(
      trip.seats.map((seat) => ({
        leftAt: seat.left_at,
        noShowAt: seat.no_show_at,
        lockedShare: seat.locked_share,
      })),
      ride.expected_total_fare,
    );
    const final = trip.seats
      .map((seat, index) => ({ seat, share: shares[index] }))
      .filter((entry): entry is { seat: SeatRow; share: number } => entry.share !== null);
    await client.query(
      `INSERT INTO ride_final_shares (ride_id, user_id, role, position, share)
       SELECT $1, final.user_id, final.role, final.position, final.share
       FROM unnest($2::uuid[], $3::text[], $4::int[], $5::int[])
         AS final (user_id, role, position, share)`,
      [
        ride.id,
        final.map(({ seat }) => seat.user_id),
        final.map(({ seat }) => (seat.is_owner ? 'owner' : 'rider')),
        final.map((_, index) => index + 1),
        final.map(({ share }) => share),
      ],
    );
    // Accepted join requests end as Completed; the notice below tells everyone on the ride.
    await completeAcceptedJoinRequests(client, ride.id, now, { notify: false });
  }

  const [title, body] = stepNotices[to](rideTitle(ride.direction, ride.hub_name));
  await notifyRiders(client, trip, 'trip_update', title, body);
  return { kind: 'done', value: tripState(updated) };
}

export type SeatState = {
  occupantId: string;
  checkedInAt: string | null;
  arrivedAt: string | null;
  noShowAt: string | null;
};

const seatState = (seat: SeatRow): SeatState => ({
  occupantId: seat.id,
  checkedInAt: iso(seat.checked_in_at),
  arrivedAt: iso(seat.arrived_at),
  noShowAt: iso(seat.no_show_at),
});

const SEAT_RETURNING = 'RETURNING id, checked_in_at, arrived_at, no_show_at';

/** The owner marks a rider arrived, or undoes it, during pickup (FR-RO-09.3). */
export async function setArrival(
  client: PoolClient,
  rideId: string,
  userId: string,
  occupantId: string,
  arrived: boolean,
  now: Date,
): Promise<TripResult<SeatState>> {
  const trip = await loadTrip(client, rideId, userId, now);
  if (!trip) return { kind: 'not_found' };
  const seat = trip.seats.find((candidate) => candidate.id === occupantId);
  if (!seat) return { kind: 'seat_not_found' };
  const refusal = arrivalRefusal(trip.role, trip.ride.state, asSeat(seat));
  if (refusal) return { kind: 'refused', code: refusal };

  const updated = (
    await client.query<SeatRow>(
      `UPDATE riders SET arrived_at = CASE WHEN $2 THEN COALESCE(arrived_at, $3) END
       WHERE id = $1 ${SEAT_RETURNING}`,
      [seat.id, arrived, now],
    )
  ).rows[0];
  return { kind: 'done', value: seatState(updated) };
}

/**
 * The owner marks a rider a no-show (FR-RO-10.1 to 10.3, FR-RD-10.3): only during pickup and from
 * 5 minutes after that rider's estimated pickup time. The rider leaves the active pool, so the
 * others' shares are worked out without them, and is told, with how to dispute it.
 */
export async function markNoShow(
  client: PoolClient,
  rideId: string,
  userId: string,
  occupantId: string,
  now: Date,
): Promise<TripResult<SeatState>> {
  const trip = await loadTrip(client, rideId, userId, now);
  if (!trip) return { kind: 'not_found' };
  const { ride } = trip;
  const seat = trip.seats.find((candidate) => candidate.id === occupantId);
  if (!seat) return { kind: 'seat_not_found' };

  const pickupTime =
    seat.agreed_pickup_at ??
    pickupTimeFor(
      itineraryFor(ride.direction, ride.departure_start, trip.seats),
      seat.id,
      ride.departure_start,
    );
  const refusal = noShowRefusal(trip.role, ride.state, asSeat(seat), pickupTime, now);
  if (refusal === 'grace_period') {
    return {
      kind: 'refused',
      code: refusal,
      availableAt: noShowAvailableAt(pickupTime).toISOString(),
    };
  }
  if (refusal) return { kind: 'refused', code: refusal };
  if (seat.no_show_at) return { kind: 'done', value: seatState(seat) };

  const updated = (
    await client.query<SeatRow>(
      `UPDATE riders SET no_show_at = $2, no_show_by = $3 WHERE id = $1 ${SEAT_RETURNING}`,
      [seat.id, now, userId],
    )
  ).rows[0];
  await markRequestNoShow(client, ride.id, seat.user_id, now);
  const title = rideTitle(ride.direction, ride.hub_name);
  await notifyRiders(
    client,
    trip,
    'no_show_recorded',
    'You were marked as a no-show',
    `The owner of ${title} marked you as a no-show at pickup, so you are no longer on this ride and owe no share of its fare. If this is wrong, you can report it from the ride page within 7 days.`,
    seat.user_id,
  );
  return { kind: 'done', value: seatState(updated) };
}

/** A rider says they are at their pickup point, from the lock until the trip starts (FR-RD-10.4). */
export async function checkIn(
  client: PoolClient,
  rideId: string,
  userId: string,
  now: Date,
): Promise<TripResult<SeatState>> {
  const trip = await loadTrip(client, rideId, userId, now);
  if (!trip) return { kind: 'not_found' };
  const seat = trip.seats.find((candidate) => candidate.user_id === userId && !candidate.left_at);
  if (!seat) return { kind: 'not_found' };
  const refusal = checkInRefusal(
    trip.ride.state,
    trip.ride.departure_start,
    now,
    asSeat(seat),
    trip.ride.locked_at,
  );
  if (refusal) return { kind: 'refused', code: refusal };

  const updated = (
    await client.query<SeatRow>(
      `UPDATE riders SET checked_in_at = COALESCE(checked_in_at, $2) WHERE id = $1 ${SEAT_RETURNING}`,
      [seat.id, now],
    )
  ).rows[0];
  return { kind: 'done', value: seatState(updated) };
}

/**
 * A short fingerprint of everything on the trip that the ride page shows, for seat holders only,
 * or null for anyone else. The page asks for it every few seconds while the trip is under way and
 * reads the ride again only when it changes (P-13).
 */
export const TRIP_STAMP_SQL = `
  SELECT r.state,
         md5(concat_ws('|', r.state, r.pickup_started_at, r.trip_started_at, r.completed_at,
             r.cancelled_at,
             (SELECT string_agg(concat_ws(',', m.id, m.left_at, m.checked_in_at, m.arrived_at,
                                          m.no_show_at), ';' ORDER BY m.id)
              FROM riders m WHERE m.ride_id = r.id))) AS stamp
  FROM rides r
  WHERE r.id = $1
    AND EXISTS (SELECT 1 FROM riders me
                WHERE me.ride_id = r.id AND me.user_id = $2 AND me.left_at IS NULL)`;
