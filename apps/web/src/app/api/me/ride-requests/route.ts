import { pool } from '@/lib/db';
import { getCurrentUser, json } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);
  }

  try {
    const requestsResult = await pool.query(
      `SELECT
         id,
         ride_id,
         pickup_point_id,
         status,
         departure_snapshot,
         pickup_time_snapshot,
         estimated_share_snapshot,
         reason_code,
         submitted_at,
         updated_at
       FROM ride_join_requests
       WHERE rider_id = $1
       ORDER BY submitted_at DESC`,
      [user.id],
    );

    const requests = requestsResult.rows;

    if (requests.length === 0) {
      return json({ requests: [] }, 200);
    }

    const requestIds = requests.map((request: { id: string }) => request.id);

    const historyResult = await pool.query(
      `SELECT
         id,
         request_id,
         previous_status,
         new_status,
         reason_code,
         changed_by,
         changed_at
       FROM ride_join_request_history
       WHERE request_id = ANY($1::uuid[])
       ORDER BY changed_at ASC`,
      [requestIds],
    );

    const historyByRequest = new Map<string, unknown[]>();

    for (const event of historyResult.rows) {
      const events = historyByRequest.get(event.request_id) ?? [];
      events.push({
        id: event.id,
        previousStatus: event.previous_status,
        newStatus: event.new_status,
        reasonCode: event.reason_code,
        changedBy: event.changed_by,
        changedAt: event.changed_at,
      });
      historyByRequest.set(event.request_id, events);
    }

    return json(
      {
        requests: requests.map(
          (request: {
            id: string;
            ride_id: string;
            pickup_point_id: string;
            status: string;
            departure_snapshot: Date;
            pickup_time_snapshot: Date;
            estimated_share_snapshot: number;
            reason_code: string | null;
            submitted_at: Date;
            updated_at: Date;
          }) => ({
            id: request.id,
            rideId: request.ride_id,
            pickupPointId: request.pickup_point_id,
            status: request.status,
            departureSnapshot: request.departure_snapshot,
            pickupTimeSnapshot: request.pickup_time_snapshot,
            estimatedShare: request.estimated_share_snapshot,
            reasonCode: request.reason_code,
            submittedAt: request.submitted_at,
            updatedAt: request.updated_at,
            history: historyByRequest.get(request.id) ?? [],
          }),
        ),
      },
      200,
    );
  } catch (error) {
    console.error('Get rider requests failed:', error);

    return json(
      {
        error: 'Unable to load your ride requests.',
        code: 'ride_requests_fetch_failed',
      },
      500,
    );
  }
}
