import { pool } from '@/lib/db';
import { getCurrentUser, json } from '@/lib/auth';

type RideRequestRow = {
  id: string;
  ride_id: string;
  pickup_location_id: string;
  status: string;
  snapshot_departure_start: Date;
  snapshot_pickup_at: Date;
  snapshot_estimated_share: number;
  reason_code: string | null;
  submitted_at: Date;
  updated_at: Date;
};

type RequestEventRow = {
  id: string;
  request_id: string;
  previous_status: string | null;
  new_status: string;
  reason_code: string | null;
  changed_at: Date;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return json({ error: 'Authentication required.', code: 'unauthenticated' }, 401);
  }

  try {
    const requestsResult = await pool.query<RideRequestRow>(
      `SELECT
         id,
         ride_id,
         pickup_location_id,
         status,
         snapshot_departure_start,
         snapshot_pickup_at,
         snapshot_estimated_share,
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

    const historyResult = await pool.query<RequestEventRow>(
      `SELECT
         id,
         request_id,
         from_status AS previous_status,
         to_status AS new_status,
         reason_code,
         created_at AS changed_at
       FROM ride_join_request_events
       WHERE request_id = ANY($1::uuid[])
       ORDER BY created_at ASC, id ASC`,
      [requestIds],
    );

    const historyByRequest = new Map<string, Array<{
      id: string;
      previousStatus: string | null;
      newStatus: string;
      reasonCode: string | null;
      changedBy: null;
      changedAt: Date;
    }>>();

    for (const event of historyResult.rows) {
      const events = historyByRequest.get(event.request_id) ?? [];
      events.push({
        id: event.id,
        previousStatus: event.previous_status,
        newStatus: event.new_status,
        reasonCode: event.reason_code,
        changedBy: null,
        changedAt: event.changed_at,
      });
      historyByRequest.set(event.request_id, events);
    }

    return json(
      {
        requests: requests.map(
          (request) => ({
            id: request.id,
            rideId: request.ride_id,
            pickupPointId: request.pickup_location_id,
            status: request.status,
            departureSnapshot: request.snapshot_departure_start,
            pickupTimeSnapshot: request.snapshot_pickup_at,
            estimatedShare: request.snapshot_estimated_share,
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
