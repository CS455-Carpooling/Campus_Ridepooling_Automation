import { pool } from '@/lib/db';
import { getCurrentUser, guard, json, readJson } from '@/lib/auth';
import { estimateShare } from '@/lib/fare';
import { getActiveSuspension } from '@/lib/suspensions';
import { suspendedMessage } from '@/lib/enforcement-rules';
import { RIDE_REQUEST_RULES, validateJoinRequest } from '@/lib/ride-request-rules';
import type { PoolClient } from 'pg';

type RideRow = {
  id: string;
  owner_id: string;
  departure_start: Date;
  expected_total_fare: number;
  capacity_snapshot: number;
  state: string;
};

type RequestRow = {
  id: string;
  ride_id: string;
  rider_id: string;
  pickup_point_id: string;
  status: string;
  departure_snapshot: Date;
  pickup_time_snapshot: Date;
  estimated_share_snapshot: number;
  submitted_at: Date;
};

const MINUTE_MS = 60_000;

function errorResponse(message: string, status: number, code: string) {
  return json({ error: message, code }, status);
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = await guard('submit-join-request', 20, 900);
  if (blocked) return blocked;

  const user = await getCurrentUser();

  if (!user) {
    return errorResponse('Authentication required.', 401, 'unauthenticated');
  }

  const { id: rideId } = await context.params;

  // Validate the route ID before using it in a database query.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rideId)) {
    return errorResponse('Invalid ride ID.', 400, 'invalid_ride_id');
  }

  const body = await readJson(req);
  const validation = validateJoinRequest(body);

  if (!validation.ok) {
    return errorResponse(validation.message, 400, 'invalid_request');
  }

  const { pickupPointId, idempotencyKey } = validation.value;

  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    /*
     * Lock this user's row first.
     * This serializes concurrent submissions by the same rider and
     * protects the request limit and idempotency check.
     */
    const account = await client.query<{
      id: string;
      email_verified_at: Date | null;
    }>(
      `SELECT id, email_verified_at
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [user.id],
    );

    const accountRow = account.rows[0];

    if (!accountRow) {
      await client.query('ROLLBACK');
      return errorResponse('Authentication required.', 401, 'unauthenticated');
    }

    if (!accountRow.email_verified_at) {
      await client.query('ROLLBACK');
      return errorResponse(
        'Verify your IITK email before requesting a ride.',
        403,
        'email_not_verified',
      );
    }

    const suspension = await getActiveSuspension(user.id, new Date(), client);

    if (suspension) {
      await client.query('ROLLBACK');
      return json(
        {
          error: suspendedMessage(suspension, 'request to join a ride'),
          code: 'suspended',
        },
        403,
      );
    }

    /*
     * Repeated submissions with the same key within 24 hours return
     * the original request instead of creating another one.
     */
    const previousRequest = await client.query<RequestRow>(
      `SELECT id, ride_id, rider_id, pickup_point_id, status,
              departure_snapshot, pickup_time_snapshot,
              estimated_share_snapshot, submitted_at
       FROM ride_join_requests
       WHERE rider_id = $1
         AND idempotency_key = $2
         AND submitted_at >= now() - make_interval(hours => $3)
       LIMIT 1`,
      [user.id, idempotencyKey, RIDE_REQUEST_RULES.idempotencyWindowHours],
    );

    if (previousRequest.rows[0]) {
      const previous = previousRequest.rows[0];

      await client.query('COMMIT');

      return json(
        {
          request: {
            id: previous.id,
            rideId: previous.ride_id,
            status: previous.status,
            pickupPointId: previous.pickup_point_id,
            departureSnapshot: previous.departure_snapshot,
            pickupTimeSnapshot: previous.pickup_time_snapshot,
            estimatedShare: previous.estimated_share_snapshot,
            submittedAt: previous.submitted_at,
          },
          reused: true,
        },
        200,
      );
    }

    // Lock the ride so two riders cannot take its last seat simultaneously.
    const rideResult = await client.query<RideRow>(
      `SELECT id, owner_id, departure_start, expected_total_fare,
              capacity_snapshot, state
       FROM rides
       WHERE id = $1
       FOR UPDATE`,
      [rideId],
    );

    const ride = rideResult.rows[0];

    if (!ride) {
      await client.query('ROLLBACK');
      return errorResponse('Ride not found.', 404, 'ride_not_found');
    }

    if (ride.owner_id === user.id) {
      await client.query('ROLLBACK');
      return errorResponse(
        'You cannot request to join your own ride.',
        409,
        'ride_owner_cannot_join',
      );
    }

    if (ride.state !== 'scheduled') {
      await client.query('ROLLBACK');
      return errorResponse('This ride is no longer open for requests.', 409, 'ride_not_open');
    }

    const now = new Date();
    const lockTime =
      ride.departure_start.getTime() - RIDE_REQUEST_RULES.minimumDepartureLeadMinutes * MINUTE_MS;

    if (now.getTime() >= lockTime) {
      await client.query('ROLLBACK');
      return errorResponse(
        'The request deadline for this ride has passed.',
        409,
        'request_deadline_passed',
      );
    }

    // Pickup IDs are text values, for example "hall-9".
    const pickupResult = await client.query<{
      id: string;
      type: string;
    }>(
      `SELECT id, type
       FROM locations
       WHERE id = $1 AND is_active = true
       FOR SHARE`,
      [pickupPointId],
    );

    if (pickupResult.rows.length === 0 || pickupResult.rows[0].type !== 'campus') {
      await client.query('ROLLBACK');
      return errorResponse('Choose an active campus pickup point.', 400, 'invalid_pickup_point');
    }

    // A confirmed rider already occupies a seat.
    const occupancyResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM riders
       WHERE ride_id = $1 AND left_at IS NULL`,
      [ride.id],
    );

    const occupants = Number(occupancyResult.rows[0]?.count ?? 0);

    if (occupants >= ride.capacity_snapshot) {
      await client.query('ROLLBACK');
      return errorResponse('This ride has no seats available.', 409, 'ride_full');
    }

    // Reject a second active or accepted request for this same ride.
    const duplicateResult = await client.query<{ id: string }>(
      `SELECT id
       FROM ride_join_requests
       WHERE ride_id = $1
         AND rider_id = $2
         AND status IN ('pending', 'needs_reconfirmation', 'accepted')
       LIMIT 1`,
      [ride.id, user.id],
    );

    if (duplicateResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return errorResponse(
        'You already have an active request for this ride.',
        409,
        'duplicate_active_request',
      );
    }

    // Count pending requests across all rides.
    const activeCountResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM ride_join_requests
       WHERE rider_id = $1
         AND status IN ('pending', 'needs_reconfirmation')`,
      [user.id],
    );

    const activeRequestCount = Number(activeCountResult.rows[0]?.count ?? 0);

    if (activeRequestCount >= RIDE_REQUEST_RULES.maxActiveRequests) {
      await client.query('ROLLBACK');
      return errorResponse(
        'You can have at most three active join requests.',
        409,
        'active_request_limit_reached',
      );
    }

    /*
     * A rider must have at least two hours between accepted rides.
     * The riders table contains the owner as well as accepted riders.
     */
    const acceptedRideConflict = await client.query<{ id: string }>(
      `SELECT other_ride.id
       FROM riders AS confirmed
       JOIN rides AS other_ride ON other_ride.id = confirmed.ride_id
       WHERE confirmed.user_id = $1
         AND confirmed.left_at IS NULL
         AND other_ride.id <> $2
         AND other_ride.state IN ('scheduled', 'pickup_in_progress', 'in_transit')
         AND ABS(
           EXTRACT(
             EPOCH FROM (other_ride.departure_start - $3::timestamptz)
           )
         ) < $4
       LIMIT 1`,
      [
        user.id,
        ride.id,
        ride.departure_start,
        RIDE_REQUEST_RULES.minimumAcceptedRideGapMinutes * 60,
      ],
    );

    if (acceptedRideConflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return errorResponse(
        'This ride departs too close to another ride you have joined.',
        409,
        'accepted_ride_time_conflict',
      );
    }

    /*
     * Current data has no route itinerary or pickup-time estimator.
     * This is a temporary proxy, not a real pickup-time prediction.
     */
    const pickupTimeSnapshot = ride.departure_start;

    const estimatedShare = estimateShare(ride.expected_total_fare, occupants);

    const inserted = await client.query<RequestRow>(
      `INSERT INTO ride_join_requests (
         ride_id,
         rider_id,
         pickup_point_id,
         status,
         idempotency_key,
         departure_snapshot,
         pickup_time_snapshot,
         estimated_share_snapshot
       )
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
       RETURNING id, ride_id, rider_id, pickup_point_id, status,
                 departure_snapshot, pickup_time_snapshot,
                 estimated_share_snapshot, submitted_at`,
      [
        ride.id,
        user.id,
        pickupPointId,
        idempotencyKey,
        ride.departure_start,
        pickupTimeSnapshot,
        estimatedShare,
      ],
    );

    const request = inserted.rows[0];

    await client.query(
      `INSERT INTO ride_join_request_history (
         request_id, previous_status, new_status, reason_code, changed_by
       )
       VALUES ($1, NULL, 'pending', 'request_submitted', $2)`,
      [request.id, user.id],
    );

    await client.query('COMMIT');

    return json(
      {
        request: {
          id: request.id,
          rideId: request.ride_id,
          status: request.status,
          pickupPointId: request.pickup_point_id,
          departureSnapshot: request.departure_snapshot,
          pickupTimeSnapshot: request.pickup_time_snapshot,
          estimatedShare: request.estimated_share_snapshot,
          submittedAt: request.submitted_at,
        },
        reused: false,
      },
      201,
    );
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
    }

    console.error('Submit join request failed:', error);

    return errorResponse(
      'Unable to submit your join request right now.',
      500,
      'join_request_failed',
    );
  } finally {
    client?.release();
  }
}
