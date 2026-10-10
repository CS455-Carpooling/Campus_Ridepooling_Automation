import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { pool } from '@/lib/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const blocked = await guard('ride-recommendation-feedback', 30, 60);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const body = await readJson(req);
  const { requestId, rideId, value } = body;
  if (typeof requestId !== 'string' || !UUID.test(requestId) ||
      typeof rideId !== 'string' || !UUID.test(rideId) ||
      (value !== 'helpful' && value !== 'not_helpful')) {
    return json({ error: 'Please provide a valid recommendation and feedback value.' }, 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO ride_recommendation_feedback (request_id, user_id, ride_id, value)
       SELECT a.request_id, a.user_id, $3::uuid, $4
         FROM ride_recommendation_audits a
        WHERE a.request_id = $1::uuid
          AND a.user_id = $2::uuid
          AND $3::uuid = ANY(a.suggested_ride_ids)
       ON CONFLICT (request_id, user_id, ride_id) DO NOTHING
       RETURNING id`,
      [requestId, user.id, rideId, value],
    );
    if (!result.rowCount) {
      return json({ error: 'This recommendation is unavailable or feedback was already submitted.' }, 409);
    }
    return json({ success: true }, 201);
  } catch {
    return json({ error: 'Unable to save feedback right now.' }, 500);
  }
}
