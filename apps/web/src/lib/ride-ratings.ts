import 'server-only';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { isUuid } from './ids';
import { ratingClosesAt, ratingWindow, type RatingEntry, type RatingWindow } from './rating-rules';
import type { Direction } from './ride-rules';
import { rideTitle, type RideState } from './ride-status';

/**
 * Someone the viewer may rate on the review page. `occupantId` is their seat
 * on this ride (riders.id), never their account ID, so the page can name whom
 * a rating is for without sending user IDs to the browser (FR-RD-02.4).
 */
export type RatingPerson = {
  occupantId: string;
  name: string;
  isOwner: boolean;
  campusPlace: string;
  /** The viewer has already rated them on this ride (a rating cannot be changed, AC2). */
  rated: boolean;
};

/** What the review page needs (CS455-39): the ride, whether rating is open, and whom to rate. */
export type RatingPage = {
  rideId: string;
  title: string;
  direction: Direction;
  /** ISO 8601 instants. */
  departureStart: string;
  departureEnd: string;
  state: RideState;
  window: RatingWindow;
  completedAt: string | null;
  /** When rating closes: 72 hours after completion, or null while the ride is not completed. */
  closesAt: string | null;
  viewerRole: 'owner' | 'rider';
  /** Everyone else on the ride, owner first, then riders in the order they joined. */
  people: RatingPerson[];
};

type PageRideRow = {
  id: string;
  direction: Direction;
  state: RideState;
  departure_start: Date;
  departure_end: Date;
  completed_at: Date | null;
  hub_name: string;
  viewer_is_owner: boolean;
};

type PersonRow = {
  occupant_id: string;
  name: string;
  is_owner: boolean;
  campus_place: string;
  rated: boolean;
};

// Only people with a seat on the ride may rate on it, so the join on the viewer's seat is the access check.
const PAGE_RIDE_SQL = `
  SELECT r.id, r.direction, r.state, r.departure_start, r.departure_end, r.completed_at,
         hub.name AS hub_name, (r.owner_id = $2) AS viewer_is_owner
  FROM rides r
  JOIN riders me ON me.ride_id = r.id AND me.user_id = $2
  JOIN locations hub ON hub.id = r.hub_id
  WHERE r.id = $1`;

// Seats, names and places only: never user IDs, email, roll numbers, or anyone else's ratings.
const PAGE_PEOPLE_SQL = `
  SELECT m.id AS occupant_id, COALESCE(profile.display_name, u.full_name) AS name,
         (m.user_id = r.owner_id) AS is_owner, place.name AS campus_place,
         EXISTS (
           SELECT 1 FROM ride_ratings given
           WHERE given.ride_id = m.ride_id AND given.rater_id = $2 AND given.ratee_id = m.user_id
         ) AS rated
  FROM riders m
  JOIN rides r ON r.id = m.ride_id
  JOIN users u ON u.id = m.user_id
  LEFT JOIN user_profiles profile ON profile.user_id = u.id
  JOIN locations place ON place.id = m.campus_location_id
  WHERE m.ride_id = $1 AND m.user_id <> $2
  ORDER BY (m.user_id = r.owner_id) DESC, m.joined_at, m.id`;

/**
 * The review page for `viewerId` on this ride, or null when the ride does not
 * exist or they have no seat on it, so the page answers "not found" either way.
 * IDs that are not UUIDs, such as the development user, return null without a query.
 */
export async function getRatingPage(
  rideId: string,
  viewerId: string,
  now: Date = new Date(),
): Promise<RatingPage | null> {
  if (!isUuid(rideId) || !isUuid(viewerId)) return null;

  const ride = (await pool.query<PageRideRow>(PAGE_RIDE_SQL, [rideId, viewerId])).rows[0];
  if (!ride) return null;

  const { rows: people } = await pool.query<PersonRow>(PAGE_PEOPLE_SQL, [rideId, viewerId]);
  return {
    rideId: ride.id,
    title: rideTitle(ride.direction, ride.hub_name),
    direction: ride.direction,
    departureStart: ride.departure_start.toISOString(),
    departureEnd: ride.departure_end.toISOString(),
    state: ride.state,
    window: ratingWindow(ride.state, ride.completed_at, now),
    completedAt: ride.completed_at ? ride.completed_at.toISOString() : null,
    closesAt: ride.completed_at ? ratingClosesAt(ride.completed_at).toISOString() : null,
    viewerRole: ride.viewer_is_owner ? 'owner' : 'rider',
    people: people.map((person) => ({
      occupantId: person.occupant_id,
      name: person.name,
      isOwner: person.is_owner,
      campusPlace: person.campus_place,
      rated: person.rated,
    })),
  };
}

/** How a request to rate people went; only `rated` means the ratings were stored. */
export type SubmitRatingsResult =
  | { kind: 'rated'; count: number }
  | { kind: 'not_found' }
  | { kind: 'window'; window: Exclude<RatingWindow, 'open'> }
  | { kind: 'self' }
  | { kind: 'not_on_ride' }
  | { kind: 'already_rated' };

// Locks the rater's own seat, so two requests from the same person run one after the other,
// and the seat cannot be given up while the ratings are being stored.
const RATER_SQL = `
  SELECT me.id AS seat_id, r.state, r.completed_at
  FROM riders me
  JOIN rides r ON r.id = me.ride_id
  WHERE me.ride_id = $1 AND me.user_id = $2
  FOR NO KEY UPDATE OF me`;

const SEATS_SQL = `
  SELECT id AS occupant_id, user_id FROM riders
  WHERE ride_id = $1 AND id = ANY($2::uuid[])`;

const ALREADY_RATED_SQL = `
  SELECT 1 FROM ride_ratings
  WHERE ride_id = $1 AND rater_id = $2 AND ratee_id = ANY($3::uuid[])
  LIMIT 1`;

// One statement for the whole request. The database checks again that both people have a seat
// on the ride and that nobody rates twice (schema.sql), whatever happened in between.
const INSERT_SQL = `
  INSERT INTO ride_ratings (ride_id, rater_id, ratee_id, score, comment)
  SELECT $1, $2, rated.ratee_id, rated.score, rated.comment
  FROM unnest($3::uuid[], $4::smallint[], $5::text[]) AS rated (ratee_id, score, comment)
  ON CONFLICT ON CONSTRAINT ride_ratings_once DO NOTHING
  RETURNING ratee_id`;

/**
 * Stores `raterId`'s ratings of people on this ride (FR-RD-12.1 to 12.3), all
 * or none, inside the caller's transaction on `client`. The caller commits only
 * when the result is `rated`, and rolls back otherwise. `entries` come from
 * parseRatingsRequest, so they are already checked and free of duplicates.
 */
export async function submitRatings(
  client: PoolClient,
  rideId: string,
  raterId: string,
  entries: RatingEntry[],
  now: Date,
): Promise<SubmitRatingsResult> {
  const rater = (
    await client.query<{ seat_id: string; state: RideState; completed_at: Date | null }>(
      RATER_SQL,
      [rideId, raterId],
    )
  ).rows[0];
  if (!rater) return { kind: 'not_found' };

  const window = ratingWindow(rater.state, rater.completed_at, now);
  if (window !== 'open') return { kind: 'window', window };

  const occupantIds = entries.map((entry) => entry.occupantId);
  if (occupantIds.includes(rater.seat_id)) return { kind: 'self' };

  const { rows: seats } = await client.query<{ occupant_id: string; user_id: string }>(SEATS_SQL, [
    rideId,
    occupantIds,
  ]);
  const userBySeat = new Map(seats.map((seat) => [seat.occupant_id, seat.user_id]));
  if (occupantIds.some((id) => !userBySeat.has(id))) return { kind: 'not_on_ride' };

  const rateeIds = occupantIds.map((id) => userBySeat.get(id) as string);
  const existing = await client.query(ALREADY_RATED_SQL, [rideId, raterId, rateeIds]);
  if (existing.rows.length > 0) return { kind: 'already_rated' };

  const inserted = await client.query(INSERT_SQL, [
    rideId,
    raterId,
    rateeIds,
    entries.map((entry) => entry.score),
    entries.map((entry) => entry.comment),
  ]);
  // Fewer rows than ratings: another request got there first. The caller rolls back.
  if (inserted.rows.length !== entries.length) return { kind: 'already_rated' };
  return { kind: 'rated', count: inserted.rows.length };
}
