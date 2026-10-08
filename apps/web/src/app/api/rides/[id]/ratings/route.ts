import type { PoolClient } from 'pg';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { pool } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { parseRatingsRequest, ratingMessages } from '@/lib/rating-rules';
import { submitRatings, type SubmitRatingsResult } from '@/lib/ride-ratings';

type Refusal = Exclude<SubmitRatingsResult, { kind: 'rated' }>;

const windowRefusals = {
  not_completed: 'This ride is not marked completed yet, so nobody on it can be rated.',
  cancelled: 'A cancelled ride cannot be rated.',
  closed: 'Rating for this ride closed 72 hours after it was completed.',
} as const;

function refuse(result: Refusal): Response {
  switch (result.kind) {
    case 'not_found':
      return json({ error: 'Ride not found.', code: 'not_found' }, 404);
    case 'window':
      return json({ error: windowRefusals[result.window], code: result.window }, 409);
    case 'self':
      return json({ error: 'You cannot rate yourself.', code: 'self_rating' }, 400);
    case 'not_on_ride':
      return json({ error: ratingMessages.person, code: 'not_on_ride' }, 400);
    case 'already_rated':
      return json(
        {
          error: 'You have already rated someone in this list, and a rating cannot be changed.',
          code: 'already_rated',
        },
        409,
      );
  }
}

/**
 * POST /api/rides/[id]/ratings (CS455-42, FR-RD-12.1 to 12.3, FR-RO-12.1): the
 * signed-in person rates others on a completed ride, within 72 hours, once
 * each. Body: { ratings: [{ occupantId, score, comment? }] }, where occupantId
 * is a seat on the ride. All of them are stored, or none. The answer says only
 * how many were stored: never user IDs, scores or who rated whom.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/rides/[id]/ratings'>) {
  const blocked = await guard('rate-ride', 60, 900);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);

  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: 'Ride not found.', code: 'not_found' }, 404);

  const parsed = parseRatingsRequest(await readJson(req));
  if (!parsed.ok) return json({ error: parsed.error, code: 'invalid_ratings' }, 400);

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await submitRatings(client, id, user.id, parsed.ratings, new Date());
    if (result.kind !== 'rated') {
      await client.query('ROLLBACK');
      return refuse(result);
    }
    await client.query('COMMIT');
    return json({ rated: result.count }, 201);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Rate ride failed:', error);
    return json({ error: 'Unable to save the ratings right now.', code: 'server_error' }, 500);
  } finally {
    client?.release();
  }
}
