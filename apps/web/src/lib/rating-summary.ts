import 'server-only';
import { pool } from './db';
import { isUuid } from './ids';
import { RATING_RULES, type OwnRating } from './rating-rules';

/**
 * Ratings count only once their ride's 72-hour window has closed (CS455-44).
 * All the ratings from one ride then appear together, so nobody can tell from
 * when their average moved who rated them, or how.
 */
const released = (rideAlias: string, nowParam: string) =>
  `${rideAlias}.completed_at + make_interval(hours => ${RATING_RULES.windowHours}) <= ${nowParam}`;

/**
 * A LEFT JOIN LATERAL, for a query about people, that gives the person in
 * `userColumn` a `rating_count` and a `rating_average` (one decimal) from their
 * released ratings at the time in `nowParam`. Both are NULL below 3 ratings
 * (P-24), so a query cannot show an average that rests on fewer. It never reads
 * who gave a rating.
 */
export function publicRatingJoin(userColumn: string, nowParam: string): string {
  return `LEFT JOIN LATERAL (
    SELECT count(*)::int AS rating_count,
           round(avg(rated.score), 1)::float8 AS rating_average
    FROM ride_ratings rated
    JOIN rides rated_ride ON rated_ride.id = rated.ride_id
    WHERE rated.ratee_id = ${userColumn} AND ${released('rated_ride', nowParam)}
    HAVING count(*) >= ${RATING_RULES.minRatingsToShow}
  ) public_rating ON true`;
}

/** The most comments the profile shows, newest ride first. */
export const OWN_COMMENTS_LIMIT = 20;

const OWN_COUNT_SQL = `
  SELECT count(*)::int AS count, round(avg(rated.score), 1)::float8 AS average
  FROM ride_ratings rated
  JOIN rides rated_ride ON rated_ride.id = rated.ride_id
  WHERE rated.ratee_id = $1 AND ${released('rated_ride', '$2')}`;

// The text alone: no rater, score, ride or date. Newest ride first; within a ride the order is
// by the random rating ID, so it does not follow the order people rated in.
const OWN_COMMENTS_SQL = `
  SELECT rated.comment
  FROM ride_ratings rated
  JOIN rides rated_ride ON rated_ride.id = rated.ride_id
  WHERE rated.ratee_id = $1 AND rated.comment IS NOT NULL AND ${released('rated_ride', '$2')}
  ORDER BY rated_ride.completed_at DESC, rated.id
  LIMIT $3`;

const noRatings: OwnRating = { count: 0, average: null, comments: [] };

/**
 * What `userId` sees about their own ratings on their profile: how many have
 * been released, and from 3 up their average and the comments people left,
 * without saying who wrote them. A user ID that is not a UUID (the development
 * user) has none, without a query.
 */
export async function getOwnRating(userId: string, now: Date = new Date()): Promise<OwnRating> {
  if (!isUuid(userId)) return noRatings;

  const { rows } = await pool.query<{ count: number; average: number | null }>(OWN_COUNT_SQL, [
    userId,
    now,
  ]);
  const count = rows[0]?.count ?? 0;
  if (count < RATING_RULES.minRatingsToShow) return { count, average: null, comments: [] };

  const comments = await pool.query<{ comment: string }>(OWN_COMMENTS_SQL, [
    userId,
    now,
    OWN_COMMENTS_LIMIT,
  ]);
  return {
    count,
    average: rows[0].average,
    comments: comments.rows.map((row) => row.comment),
  };
}
