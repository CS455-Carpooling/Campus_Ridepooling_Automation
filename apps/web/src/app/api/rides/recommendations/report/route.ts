import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { pseudonymizeRecommendationRider } from '@/lib/ai/recommendation-audit';
import { pool } from '@/lib/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const blocked = await guard('ride-recommendation-report', 10, 60);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const { requestId, rideId, reason } = await readJson(req);
  if (
    typeof requestId !== 'string' ||
    !UUID.test(requestId) ||
    typeof rideId !== 'string' ||
    !UUID.test(rideId) ||
    (reason !== 'wrong' && reason !== 'inappropriate')
  ) {
    return json({ error: 'Please provide a valid recommendation report.' }, 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO ride_recommendation_reports (request_id, rider_pseudonym, ride_id, reason)
       SELECT a.request_id, a.rider_pseudonym, $3::uuid, $4
         FROM ride_recommendation_audits a
        WHERE a.request_id = $1::uuid
          AND a.rider_pseudonym = $2
          AND $3::uuid = ANY(a.suggested_ride_ids)
       ON CONFLICT (request_id, rider_pseudonym, ride_id) DO NOTHING
       RETURNING id`,
      [requestId, pseudonymizeRecommendationRider(user.id), rideId, reason],
    );
    if (!result.rowCount) {
      return json(
        { error: 'This recommendation is unavailable or has already been reported.' },
        409,
      );
    }
    return json({ success: true }, 201);
  } catch (error) {
    console.error('Save recommendation report failed:', error);
    return json({ error: 'Unable to save this report right now.' }, 500);
  }
}
