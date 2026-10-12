import 'server-only';
import type { PoolClient } from 'pg';
import { estimateShare, splitFare } from './fare';
import { pool } from './db';
import { getCampusTravelTimeMinutes } from './ai/campus-travel-times';
import {
  ACTIVE_JOIN_REQUEST_STATES,
  MAX_WAITING_REQUESTS,
  REQUEST_CONFLICT_WINDOW_MS,
  REQUEST_IDEMPOTENCY_TTL_MS,
  hasMaterialRequestDrift,
  type JoinRequestState,
  type RequestSnapshot,
} from './join-request-rules';
import { isUuid } from './ids';
import { lockTime, type RideState } from './ride-status';

type RideRow = {
  id: string;
  owner_id: string;
  direction: 'to_hub' | 'from_hub';
  state: RideState;
  departure_start: Date;
  departure_end: Date;
  expected_total_fare: number;
  capacity_snapshot: number;
  locked_at: Date | null;
};

type RequestRow = {
  id: string;
  ride_id: string;
  rider_id: string;
  status: JoinRequestState;
  reason_code: string | null;
  pickup_location_id: string;
  submitted_at: Date;
  snapshot_departure_start: Date;
  snapshot_pickup_at: Date;
  snapshot_estimated_share: number;
  accepted_departure_start: Date | null;
  accepted_pickup_at: Date | null;
  locked_share: number | null;
  no_liability_until_trip: boolean;
};

type SeatRow = { user_id: string; campus_location_id: string; locked_share: number | null };

type FailureKind =
  | 'not_found'
  | 'not_owner'
  | 'not_rider'
  | 'suspended'
  | 'ride_closed'
  | 'ride_locked'
  | 'ride_full'
  | 'invalid_pickup'
  | 'pickup_estimate_unavailable'
  | 'already_requested'
  | 'active_request_limit'
  | 'departure_conflict'
  | 'request_not_active'
  | 'request_not_pending'
  | 'request_not_reconfirming'
  | 'late_confirmation_required'
  | 'trip_started'
  | 'cannot_leave_owner_seat';

export type JoinRequestResult =
  | { kind: 'created'; requestId: string; state: 'pending'; idempotent: false }
  | { kind: 'existing'; requestId: string; state: JoinRequestState; idempotent: true }
  | { kind: 'accepted'; requestId: string }
  | { kind: 'rejected'; requestId: string }
  | { kind: 'reconfirmed'; requestId: string }
  | { kind: 'withdrawn'; requestId: string }
  | { kind: 'left'; requestId: string; lateCancellation: boolean; lockedShare: number | null }
  | { kind: 'expired'; requestId: string }
  | { kind: 'ride_cancelled'; requestId: string }
  | { kind: 'locked'; rideId: string }
  | { kind: 'cancelled'; rideId: string }
  | { kind: 'edited'; rideId: string }
  | { kind: 'confirmation_required'; detail: string }
  | { kind: FailureKind; detail?: string };

const ACTIVE_REQUEST_SQL = `
  SELECT id, ride_id, rider_id, status, reason_code, pickup_location_id, submitted_at,
         snapshot_departure_start, snapshot_pickup_at, snapshot_estimated_share,
         accepted_departure_start, accepted_pickup_at, locked_share, no_liability_until_trip
  FROM ride_join_requests`;

async function recordEvent(
  client: PoolClient,
  requestId: string,
  from: JoinRequestState | null,
  to: JoinRequestState,
  reasonCode: string | null,
  details: Record<string, unknown> = {},
  now: Date,
) {
  await client.query(
    `INSERT INTO ride_join_request_events
       (request_id, from_status, to_status, reason_code, details, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [requestId, from, to, reasonCode, JSON.stringify(details), now],
  );
}

async function notify(
  client: PoolClient,
  userId: string,
  type: 'join_request' | 'join_request_update' | 'ride_share_update',
  title: string,
  body: string,
  rideId: string,
  now: Date,
) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, related_ride_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, body, rideId, now],
  );
}

async function lockUser(client: PoolClient, userId: string): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT id FROM users WHERE id = $1 AND role = 'student' FOR UPDATE`,
    [userId],
  );
  return rows.length > 0;
}

async function hasSuspension(client: PoolClient, userId: string, now: Date): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM rider_suspensions
     WHERE user_id = $1 AND lifted_at IS NULL AND starts_at <= $2
       AND (ends_at IS NULL OR ends_at > $2)
     LIMIT 1`,
    [userId, now],
  );
  return rows.length > 0;
}

async function lockRide(client: PoolClient, rideId: string): Promise<RideRow | null> {
  const { rows } = await client.query<RideRow>(
    `SELECT id, owner_id, direction, state, departure_start, departure_end,
            expected_total_fare, capacity_snapshot, locked_at
     FROM rides WHERE id = $1 FOR NO KEY UPDATE`,
    [rideId],
  );
  return rows[0] ?? null;
}

function rideIsLocked(ride: RideRow, now: Date): boolean {
  return Boolean(ride.locked_at) || now.getTime() >= lockTime(ride.departure_start).getTime();
}

async function seatsForRide(client: PoolClient, rideId: string): Promise<SeatRow[]> {
  const { rows } = await client.query<SeatRow>(
    `SELECT user_id, campus_location_id, locked_share
     FROM riders WHERE ride_id = $1 AND left_at IS NULL
     ORDER BY (user_id = (SELECT owner_id FROM rides WHERE id = $1)) DESC, joined_at, id`,
    [rideId],
  );
  return rows;
}

async function pickupEstimate(
  client: PoolClient,
  ride: RideRow,
  pickupLocationId: string,
  seats?: SeatRow[],
): Promise<Date | null> {
  if (ride.direction === 'from_hub') return ride.departure_start;
  const currentSeats = seats ?? (await seatsForRide(client, ride.id));
  const ownerSeat = currentSeats.find((seat) => seat.user_id === ride.owner_id);
  if (!ownerSeat) return null;

  const locationIds = [
    ...new Set([...currentSeats.map((seat) => seat.campus_location_id), pickupLocationId]),
  ];
  const { rows: locations } = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM locations WHERE id = ANY($1::text[])`,
    [locationIds],
  );
  const names = new Map(locations.map((location) => [location.id, location.name]));
  const ownerName = names.get(ownerSeat.campus_location_id);
  const targetName = names.get(pickupLocationId);
  if (!ownerName || !targetName) return null;

  const remaining = new Set(
    currentSeats
      .map((seat) => names.get(seat.campus_location_id))
      .filter((name): name is string => Boolean(name)),
  );
  remaining.add(targetName);
  remaining.delete(ownerName);

  let current = ownerName;
  let elapsedMinutes = 0;
  while (remaining.size > 0) {
    let nearest: string | null = null;
    let nearestMinutes = Number.POSITIVE_INFINITY;
    for (const candidate of remaining) {
      const minutes = getCampusTravelTimeMinutes(current, candidate);
      if (minutes !== null && minutes < nearestMinutes) {
        nearest = candidate;
        nearestMinutes = minutes;
      }
    }
    if (nearest === null) return null;
    elapsedMinutes += nearestMinutes;
    if (nearest === targetName) {
      return new Date(ride.departure_start.getTime() + elapsedMinutes * 60_000);
    }
    remaining.delete(nearest);
    current = nearest;
  }
  return new Date(ride.departure_start.getTime() + elapsedMinutes * 60_000);
}

async function requestSnapshot(
  client: PoolClient,
  ride: RideRow,
  pickupLocationId: string,
  seats?: SeatRow[],
): Promise<RequestSnapshot | null> {
  const currentSeats = seats ?? (await seatsForRide(client, ride.id));
  const pickupAt = await pickupEstimate(client, ride, pickupLocationId, currentSeats);
  if (!pickupAt) return null;
  return {
    departureStart: ride.departure_start,
    pickupAt,
    estimatedShare: estimateShare(ride.expected_total_fare, currentSeats.length),
  };
}

function requestFailure(kind: FailureKind, detail?: string): JoinRequestResult {
  return detail ? { kind, detail } : { kind };
}

async function expireWaitingRequests(client: PoolClient, rideId: string, now: Date) {
  const { rows } = await client.query<RequestRow>(
    `${ACTIVE_REQUEST_SQL}
     WHERE ride_id = $1 AND status IN ('pending', 'needs_reconfirmation')
     FOR NO KEY UPDATE`,
    [rideId],
  );
  for (const request of rows) {
    await client.query(
      `UPDATE ride_join_requests
       SET status = 'expired', reason_code = 'lock_time', decided_at = $2, updated_at = $2
       WHERE id = $1`,
      [request.id, now],
    );
    await recordEvent(client, request.id, request.status, 'expired', 'lock_time', {}, now);
    await notify(
      client,
      request.rider_id,
      'join_request_update',
      'Join request expired',
      'The ride reached its lock time before the owner decided on your request.',
      rideId,
      now,
    );
  }
}

async function lockRideAt(client: PoolClient, ride: RideRow, now: Date): Promise<void> {
  if (ride.state !== 'scheduled' || rideIsLocked(ride, now)) {
    if (ride.state === 'scheduled' && !ride.locked_at) {
      await client.query('UPDATE rides SET locked_at = $2 WHERE id = $1', [ride.id, now]);
      const seats = await seatsForRide(client, ride.id);
      const shares = splitFare(ride.expected_total_fare, seats.length);
      for (const [index, seat] of seats.entries()) {
        await client.query(
          `UPDATE riders SET locked_share = $3
           WHERE ride_id = $1 AND user_id = $2 AND left_at IS NULL`,
          [ride.id, seat.user_id, shares[index]],
        );
      }
      await client.query(
        `UPDATE ride_join_requests request
         SET locked_share = seat.locked_share
         FROM riders seat
         WHERE request.ride_id = $1 AND request.status = 'accepted'
           AND request.rider_id = seat.user_id AND seat.ride_id = request.ride_id
           AND seat.left_at IS NULL`,
        [ride.id],
      );
    }
    await expireWaitingRequests(client, ride.id, now);
  }
}

async function refreshPendingSnapshots(
  client: PoolClient,
  ride: RideRow,
  now: Date,
  seats: SeatRow[],
) {
  const { rows } = await client.query<RequestRow>(
    `${ACTIVE_REQUEST_SQL}
     WHERE ride_id = $1 AND status IN ('pending', 'needs_reconfirmation')
     ORDER BY submitted_at, id FOR NO KEY UPDATE`,
    [ride.id],
  );

  for (const request of rows) {
    const next = await requestSnapshot(client, ride, request.pickup_location_id, seats);
    if (!next) continue;
    const previous = {
      departureStart: request.snapshot_departure_start,
      pickupAt: request.snapshot_pickup_at,
      estimatedShare: request.snapshot_estimated_share,
    };
    const drifted = hasMaterialRequestDrift(previous, next);
    const nextStatus: JoinRequestState =
      request.status === 'needs_reconfirmation' || drifted ? 'needs_reconfirmation' : 'pending';
    const changed = nextStatus !== request.status;
    await client.query(
      `UPDATE ride_join_requests
       SET status = $2, current_departure_start = $3, current_pickup_at = $4,
           current_estimated_share = $5, reason_code = CASE WHEN $2 = 'needs_reconfirmation'
             THEN 'itinerary_changed' ELSE NULL END, updated_at = $6
       WHERE id = $1`,
      [request.id, nextStatus, next.departureStart, next.pickupAt, next.estimatedShare, now],
    );
    if (changed) {
      const oldStatus = request.status;
      await recordEvent(
        client,
        request.id,
        oldStatus,
        nextStatus,
        'itinerary_changed',
        {
          old: {
            departureStart: previous.departureStart.toISOString(),
            pickupAt: previous.pickupAt.toISOString(),
            estimatedShare: previous.estimatedShare,
          },
          current: {
            departureStart: next.departureStart.toISOString(),
            pickupAt: next.pickupAt.toISOString(),
            estimatedShare: next.estimatedShare,
          },
        },
        now,
      );
      if (drifted) {
        await notify(
          client,
          request.rider_id,
          'join_request_update',
          'Your request needs confirmation',
          'The ride time, pickup estimate, or fare estimate changed materially. Review the new terms before the owner can accept.',
          ride.id,
          now,
        );
      }
    }
  }
}

async function refreshAcceptedItinerary(
  client: PoolClient,
  ride: RideRow,
  now: Date,
  seats: SeatRow[],
) {
  const { rows } = await client.query<RequestRow>(
    `${ACTIVE_REQUEST_SQL}
     WHERE ride_id = $1 AND status = 'accepted'
     ORDER BY accepted_at, id FOR NO KEY UPDATE`,
    [ride.id],
  );
  const shares = splitFare(ride.expected_total_fare, Math.max(seats.length, 1));
  for (const request of rows) {
    const pickupAt = await pickupEstimate(client, ride, request.pickup_location_id, seats);
    if (!pickupAt) continue;
    const acceptedDeparture = request.accepted_departure_start ?? request.snapshot_departure_start;
    const acceptedPickup = request.accepted_pickup_at ?? request.snapshot_pickup_at;
    const timeChanged =
      Math.abs(ride.departure_start.getTime() - acceptedDeparture.getTime()) > 10 * 60_000 ||
      Math.abs(pickupAt.getTime() - acceptedPickup.getTime()) > 10 * 60_000;
    const conflict = await acceptedRideConflict(client, request.rider_id, ride);
    const newlyExempt = (timeChanged || conflict) && !request.no_liability_until_trip;
    const share = shares[seats.findIndex((seat) => seat.user_id === request.rider_id)] ?? 0;
    await client.query(
      `UPDATE ride_join_requests
       SET current_departure_start = $2, current_pickup_at = $3,
           current_estimated_share = $4,
           no_liability_until_trip = no_liability_until_trip OR $5,
           reason_code = CASE WHEN $5 THEN 'changed_terms' ELSE reason_code END,
           updated_at = $6
       WHERE id = $1`,
      [request.id, ride.departure_start, pickupAt, share, timeChanged || conflict, now],
    );
    if (newlyExempt) {
      await recordEvent(
        client,
        request.id,
        'accepted',
        'accepted',
        timeChanged ? 'changed_terms' : 'departure_conflict',
        {
          acceptedDeparture: acceptedDeparture.toISOString(),
          currentDeparture: ride.departure_start.toISOString(),
          acceptedPickup: acceptedPickup.toISOString(),
          currentPickup: pickupAt.toISOString(),
        },
        now,
      );
      await notify(
        client,
        request.rider_id,
        'join_request_update',
        'Your ride changed',
        timeChanged
          ? 'The departure or pickup estimate moved by more than 10 minutes. You may leave before pickup starts without fare liability.'
          : 'This ride now conflicts with another ride you joined. You may leave either ride before pickup starts without fare liability.',
        ride.id,
        now,
      );
    }
  }
}

async function notifyShareChanges(
  client: PoolClient,
  ride: RideRow,
  before: SeatRow[],
  after: SeatRow[],
  now: Date,
  previousFare = ride.expected_total_fare,
) {
  if (rideIsLocked(ride, now) || before.length === 0 || after.length === 0) return;
  const oldShares = new Map(
    before.map((seat, index) => [seat.user_id, splitFare(previousFare, before.length)[index]]),
  );
  const newShares = splitFare(ride.expected_total_fare, after.length);
  for (const [index, seat] of after.entries()) {
    const oldShare = oldShares.get(seat.user_id);
    const newShare = newShares[index];
    if (oldShare !== undefined && oldShare !== newShare) {
      await notify(
        client,
        seat.user_id,
        'ride_share_update',
        'Your ride fare share changed',
        `Your estimated share changed from ₹${oldShare} to ₹${newShare}.`,
        ride.id,
        now,
      );
    }
  }
}

export async function submitJoinRequest(
  client: PoolClient,
  rideId: string,
  riderId: string,
  pickupLocationId: string,
  idempotencyKey: string,
  now: Date,
): Promise<JoinRequestResult> {
  if (!isUuid(rideId) || !isUuid(riderId)) return requestFailure('not_found');
  if (!(await lockUser(client, riderId))) return requestFailure('not_rider');

  await client.query(
    'DELETE FROM ride_join_request_keys WHERE rider_id = $1 AND expires_at <= $2',
    [riderId, now],
  );
  const key = (
    await client.query<{ id: string; status: JoinRequestState }>(
      `SELECT request.id, request.status
       FROM ride_join_request_keys request_key
       JOIN ride_join_requests request ON request.id = request_key.request_id
       WHERE request_key.rider_id = $1 AND request_key.idempotency_key = $2
         AND request_key.expires_at > $3`,
      [riderId, idempotencyKey, now],
    )
  ).rows[0];
  if (key) return { kind: 'existing', requestId: key.id, state: key.status, idempotent: true };

  const ride = await lockRide(client, rideId);
  if (!ride) return requestFailure('not_found');
  if (ride.owner_id === riderId)
    return requestFailure('already_requested', 'You already own this ride.');
  if (ride.state !== 'scheduled') return requestFailure('ride_closed');
  if (rideIsLocked(ride, now)) {
    await lockRideAt(client, ride, now);
    return requestFailure('ride_locked');
  }
  if (await hasSuspension(client, riderId, now)) return requestFailure('suspended');
  if (await hasSuspension(client, ride.owner_id, now)) return requestFailure('ride_closed');

  const pickup = await client.query<{ id: string }>(
    `SELECT id FROM locations WHERE id = $1 AND type = 'campus' AND is_active = true`,
    [pickupLocationId],
  );
  if (pickup.rows.length === 0) return requestFailure('invalid_pickup');

  const active = await client.query(
    `SELECT 1 FROM ride_join_requests
     WHERE ride_id = $1 AND rider_id = $2 AND status = ANY($3::text[])
     LIMIT 1`,
    [rideId, riderId, [...ACTIVE_JOIN_REQUEST_STATES]],
  );
  if (active.rows.length > 0) return requestFailure('already_requested');

  const pendingCount = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ride_join_requests
     WHERE rider_id = $1 AND status IN ('pending', 'needs_reconfirmation')`,
    [riderId],
  );
  if ((pendingCount.rows[0]?.count ?? 0) >= MAX_WAITING_REQUESTS) {
    return requestFailure('active_request_limit');
  }

  const seats = await seatsForRide(client, rideId);
  if (seats.length >= ride.capacity_snapshot) return requestFailure('ride_full');

  const conflict = await client.query(
    `SELECT 1
     FROM ride_join_requests request
     JOIN rides accepted_ride ON accepted_ride.id = request.ride_id
     WHERE request.rider_id = $1 AND request.status = 'accepted'
       AND abs(extract(epoch FROM (accepted_ride.departure_start - $2))) < $3
     LIMIT 1`,
    [riderId, ride.departure_start, REQUEST_CONFLICT_WINDOW_MS / 1000],
  );
  if (conflict.rows.length > 0) return requestFailure('departure_conflict');

  const snapshot = await requestSnapshot(client, ride, pickupLocationId, seats);
  if (!snapshot) return requestFailure('pickup_estimate_unavailable');

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO ride_join_requests
       (ride_id, rider_id, pickup_location_id, submitted_at,
        snapshot_departure_start, snapshot_pickup_at, snapshot_estimated_share,
        current_departure_start, current_pickup_at, current_estimated_share)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $6, $7)
     RETURNING id`,
    [
      rideId,
      riderId,
      pickupLocationId,
      now,
      snapshot.departureStart,
      snapshot.pickupAt,
      snapshot.estimatedShare,
    ],
  );
  const requestId = rows[0]?.id;
  if (!requestId) throw new Error('Join request insert returned no row.');
  await recordEvent(
    client,
    requestId,
    null,
    'pending',
    null,
    { snapshot: snapshotJson(snapshot) },
    now,
  );
  await client.query(
    `INSERT INTO ride_join_request_keys (rider_id, idempotency_key, request_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [riderId, idempotencyKey, requestId, new Date(now.getTime() + REQUEST_IDEMPOTENCY_TTL_MS)],
  );
  await notify(
    client,
    ride.owner_id,
    'join_request',
    'New ride request',
    'A rider requested a seat. Review the request on your ride page.',
    rideId,
    now,
  );
  return { kind: 'created', requestId, state: 'pending', idempotent: false };
}

function snapshotJson(snapshot: RequestSnapshot) {
  return {
    departureStart: snapshot.departureStart.toISOString(),
    pickupAt: snapshot.pickupAt.toISOString(),
    estimatedShare: snapshot.estimatedShare,
  };
}

export type JoinRequestAction =
  'accept' | 'reject' | 'reconfirm' | 'decline' | 'withdraw' | 'leave';

export async function actOnJoinRequest(
  client: PoolClient,
  rideId: string,
  requestId: string,
  actorId: string,
  action: JoinRequestAction,
  now: Date,
  confirmLate = false,
): Promise<JoinRequestResult> {
  const initial = (
    await client.query<{ rider_id: string }>(
      `SELECT rider_id FROM ride_join_requests WHERE id = $1 AND ride_id = $2`,
      [requestId, rideId],
    )
  ).rows[0];
  if (!initial) return requestFailure('not_found');
  if (!(await lockUser(client, initial.rider_id))) return requestFailure('not_rider');

  const ride = await lockRide(client, rideId);
  if (!ride) return requestFailure('not_found');
  const request = (
    await client.query<RequestRow>(
      `${ACTIVE_REQUEST_SQL} WHERE id = $1 AND ride_id = $2 FOR NO KEY UPDATE`,
      [requestId, rideId],
    )
  ).rows[0];
  if (!request) return requestFailure('not_found');

  const ownerAction = action === 'accept' || action === 'reject';
  if (ownerAction && ride.owner_id !== actorId) return requestFailure('not_owner');
  if (!ownerAction && request.rider_id !== actorId) return requestFailure('not_rider');

  const lockHasReached = rideIsLocked(ride, now) && ride.state === 'scheduled';
  if (lockHasReached) {
    await lockRideAt(client, ride, now);
  }
  if (ride.state === 'cancelled') return requestFailure('ride_closed');
  if (
    lockHasReached &&
    (request.status === 'pending' || request.status === 'needs_reconfirmation')
  ) {
    return { kind: 'expired', requestId };
  }

  if (action === 'accept') {
    if (request.status !== 'pending') {
      return requestFailure(
        request.status === 'needs_reconfirmation' ? 'request_not_pending' : 'request_not_active',
      );
    }
    if (ride.state !== 'scheduled') return requestFailure('ride_closed');
    if (rideIsLocked(ride, now)) return requestFailure('ride_locked');
    if (await hasSuspension(client, request.rider_id, now)) return requestFailure('suspended');
    const before = await seatsForRide(client, rideId);
    if (before.length >= ride.capacity_snapshot) return requestFailure('ride_full');
    const conflict = await client.query(
      `SELECT 1 FROM ride_join_requests request
       JOIN rides accepted_ride ON accepted_ride.id = request.ride_id
       WHERE request.rider_id = $1 AND request.status = 'accepted'
         AND abs(extract(epoch FROM (accepted_ride.departure_start - $2))) < $3
       LIMIT 1`,
      [request.rider_id, ride.departure_start, REQUEST_CONFLICT_WINDOW_MS / 1000],
    );
    if (conflict.rows.length > 0) {
      await client.query(
        `UPDATE ride_join_requests
         SET status = 'rejected', reason_code = 'departure_conflict', decided_at = $2, updated_at = $2
         WHERE id = $1`,
        [requestId, now],
      );
      await recordEvent(client, requestId, 'pending', 'rejected', 'departure_conflict', {}, now);
      await notify(
        client,
        request.rider_id,
        'join_request_update',
        'Request not accepted',
        'You already have an accepted ride departing within two hours.',
        rideId,
        now,
      );
      return { kind: 'rejected', requestId };
    }
    await client.query(
      `INSERT INTO riders (ride_id, user_id, campus_location_id, joined_at, left_at, locked_share)
       VALUES ($1, $2, $3, $4, NULL, NULL)
       ON CONFLICT (ride_id, user_id) DO UPDATE
       SET campus_location_id = EXCLUDED.campus_location_id, joined_at = EXCLUDED.joined_at,
           left_at = NULL, locked_share = NULL
       WHERE riders.left_at IS NOT NULL`,
      [rideId, request.rider_id, request.pickup_location_id, now],
    );
    await client.query(
      `UPDATE ride_join_requests
       SET status = 'accepted', reason_code = NULL, decided_at = $2, accepted_at = $2,
           accepted_departure_start = $3, accepted_pickup_at = $4, updated_at = $2
       WHERE id = $1`,
      [requestId, now, ride.departure_start, request.snapshot_pickup_at],
    );
    await recordEvent(client, requestId, 'pending', 'accepted', null, {}, now);
    await notify(
      client,
      request.rider_id,
      'join_request_update',
      'Your request was accepted',
      'The ride owner accepted your request. You are now in the confirmed pool.',
      rideId,
      now,
    );
    await withdrawConflictingRequests(client, request.rider_id, ride, requestId, now);
    const after = await seatsForRide(client, rideId);
    await notifyShareChanges(client, ride, before, after, now);
    await refreshAcceptedItinerary(client, ride, now, after);
    await refreshPendingSnapshots(client, ride, now, after);
    return { kind: 'accepted', requestId };
  }

  if (action === 'reject') {
    if (!['pending', 'needs_reconfirmation'].includes(request.status)) {
      return requestFailure('request_not_active');
    }
    await client.query(
      `UPDATE ride_join_requests
       SET status = 'rejected', reason_code = 'owner_rejected', decided_at = $2, updated_at = $2
       WHERE id = $1`,
      [requestId, now],
    );
    await recordEvent(client, requestId, request.status, 'rejected', 'owner_rejected', {}, now);
    await notify(
      client,
      request.rider_id,
      'join_request_update',
      'Your request was not accepted',
      'The ride owner did not accept your request.',
      rideId,
      now,
    );
    return { kind: 'rejected', requestId };
  }

  if (action === 'reconfirm' || action === 'decline') {
    if (request.status !== 'needs_reconfirmation')
      return requestFailure('request_not_reconfirming');
    if (ride.state !== 'scheduled' || rideIsLocked(ride, now)) {
      await client.query(
        `UPDATE ride_join_requests
         SET status = 'expired', reason_code = 'lock_time', decided_at = $2, updated_at = $2
         WHERE id = $1`,
        [requestId, now],
      );
      await recordEvent(client, requestId, 'needs_reconfirmation', 'expired', 'lock_time', {}, now);
      await notify(
        client,
        request.rider_id,
        'join_request_update',
        'Join request expired',
        'The ride reached its lock time before you could confirm the changed terms.',
        rideId,
        now,
      );
      return { kind: 'expired', requestId };
    }
    if (action === 'decline') {
      await transitionRequest(client, request, 'withdrawn', 'rider_declined', now);
      await notify(
        client,
        ride.owner_id,
        'join_request_update',
        'A rider withdrew their request',
        'A rider declined the changed ride terms.',
        rideId,
        now,
      );
      return { kind: 'withdrawn', requestId };
    }
    const seats = await seatsForRide(client, rideId);
    const snapshot = await requestSnapshot(client, ride, request.pickup_location_id, seats);
    if (!snapshot) return requestFailure('pickup_estimate_unavailable');
    await client.query(
      `UPDATE ride_join_requests
       SET status = 'pending', reason_code = NULL,
           snapshot_departure_start = $2, snapshot_pickup_at = $3, snapshot_estimated_share = $4,
           current_departure_start = $2, current_pickup_at = $3, current_estimated_share = $4,
           updated_at = $5
       WHERE id = $1`,
      [requestId, snapshot.departureStart, snapshot.pickupAt, snapshot.estimatedShare, now],
    );
    await recordEvent(
      client,
      requestId,
      'needs_reconfirmation',
      'pending',
      'rider_reconfirmed',
      { snapshot: snapshotJson(snapshot) },
      now,
    );
    return { kind: 'reconfirmed', requestId };
  }

  if (action === 'withdraw') {
    if (!['pending', 'needs_reconfirmation'].includes(request.status)) {
      return requestFailure('request_not_active');
    }
    await transitionRequest(client, request, 'withdrawn', 'rider_withdrew', now);
    await notify(
      client,
      ride.owner_id,
      'join_request_update',
      'A rider withdrew their request',
      'A rider withdrew their pending request.',
      rideId,
      now,
    );
    return { kind: 'withdrawn', requestId };
  }

  if (action === 'leave') {
    if (request.status !== 'accepted') return requestFailure('request_not_active');
    if (ride.owner_id === actorId) return requestFailure('cannot_leave_owner_seat');
    if (ride.state !== 'scheduled') return requestFailure('trip_started');
    const before = await seatsForRide(client, rideId);
    const currentPickup = await pickupEstimate(client, ride, request.pickup_location_id, before);
    const acceptedDeparture = request.accepted_departure_start ?? request.snapshot_departure_start;
    const acceptedPickup = request.accepted_pickup_at ?? request.snapshot_pickup_at;
    const termsChanged =
      Math.abs(ride.departure_start.getTime() - acceptedDeparture.getTime()) > 10 * 60_000 ||
      (currentPickup !== null &&
        Math.abs(currentPickup.getTime() - acceptedPickup.getTime()) > 10 * 60_000);
    const conflictNow = await acceptedRideConflict(client, actorId, ride);
    const exempt = termsChanged || conflictNow || request.no_liability_until_trip;
    const late = rideIsLocked(ride, now) && !exempt;
    if (late && !confirmLate) return requestFailure('late_confirmation_required');
    const lockedShare = late
      ? (request.locked_share ??
        before.find((seat) => seat.user_id === actorId)?.locked_share ??
        null)
      : null;
    await client.query(
      `UPDATE riders SET left_at = $3, locked_share = $4
       WHERE ride_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [rideId, actorId, now, lockedShare],
    );
    await client.query(
      `UPDATE ride_join_requests
       SET status = 'left', reason_code = $2, late_cancellation = $3,
           locked_share = $4, decided_at = $5, updated_at = $5
       WHERE id = $1`,
      [
        requestId,
        late ? 'late_cancellation' : exempt ? 'changed_terms' : 'rider_left',
        late,
        lockedShare,
        now,
      ],
    );
    await recordEvent(
      client,
      requestId,
      'accepted',
      'left',
      late ? 'late_cancellation' : exempt ? 'changed_terms' : 'rider_left',
      { lockedShare },
      now,
    );
    await notify(
      client,
      ride.owner_id,
      'join_request_update',
      'A rider left the ride',
      late
        ? `A rider left after lock; their locked share of ₹${lockedShare ?? 0} remains due.`
        : 'A rider left the ride before the trip started.',
      rideId,
      now,
    );
    const after = await seatsForRide(client, rideId);
    await notifyShareChanges(client, ride, before, after, now);
    await refreshAcceptedItinerary(client, ride, now, after);
    await refreshPendingSnapshots(client, ride, now, after);
    return { kind: 'left', requestId, lateCancellation: late, lockedShare };
  }

  return requestFailure('request_not_active');
}

async function transitionRequest(
  client: PoolClient,
  request: RequestRow,
  next: JoinRequestState,
  reasonCode: string,
  now: Date,
) {
  await client.query(
    `UPDATE ride_join_requests
     SET status = $2, reason_code = $3, decided_at = $4, updated_at = $4
     WHERE id = $1`,
    [request.id, next, reasonCode, now],
  );
  await recordEvent(client, request.id, request.status, next, reasonCode, {}, now);
}

export async function completeAcceptedJoinRequests(
  client: PoolClient,
  rideId: string,
  now: Date,
  // The trip step (CS455-62) tells everyone on the ride itself, with how long rating stays open.
  options: { notify?: boolean } = {},
): Promise<void> {
  const { rows } = await client.query<RequestRow>(
    `${ACTIVE_REQUEST_SQL}
     WHERE ride_id = $1 AND status = 'accepted'
     ORDER BY accepted_at, id FOR NO KEY UPDATE`,
    [rideId],
  );
  for (const request of rows) {
    await client.query(
      `UPDATE ride_join_requests
       SET status = 'completed', reason_code = NULL, decided_at = $2, updated_at = $2
       WHERE id = $1`,
      [request.id, now],
    );
    await recordEvent(client, request.id, 'accepted', 'completed', null, {}, now);
    if (options.notify === false) continue;
    await notify(
      client,
      request.rider_id,
      'join_request_update',
      'Ride completed',
      'The ride owner marked the ride completed.',
      rideId,
      now,
    );
  }
}

/**
 * Applies the lock now if it is due and not applied yet (CS455-60): starting pickup needs a locked
 * ride, and the maintenance loop may not have run since the lock time passed.
 */
export async function applyDueLock(client: PoolClient, rideId: string, now: Date): Promise<void> {
  const ride = await lockRide(client, rideId);
  if (ride && ride.state === 'scheduled' && rideIsLocked(ride, now)) {
    await lockRideAt(client, ride, now);
  }
}

/** The owner marked this rider a no-show (CS455-60): their accepted request ends as No-show. */
export async function markRequestNoShow(
  client: PoolClient,
  rideId: string,
  riderId: string,
  now: Date,
): Promise<void> {
  const { rows } = await client.query<RequestRow>(
    `${ACTIVE_REQUEST_SQL}
     WHERE ride_id = $1 AND rider_id = $2 AND status = 'accepted'
     FOR NO KEY UPDATE`,
    [rideId, riderId],
  );
  for (const request of rows) {
    await transitionRequest(client, request, 'no_show', 'owner_marked_no_show', now);
  }
}

export async function withdrawWaitingRequestsForSuspendedRider(
  client: PoolClient,
  riderId: string,
  now: Date,
): Promise<void> {
  const { rows } = await client.query<RequestRow & { owner_id: string }>(
    `SELECT request.id, request.ride_id, request.rider_id, request.status,
            request.reason_code, request.pickup_location_id, request.submitted_at,
            request.snapshot_departure_start, request.snapshot_pickup_at,
            request.snapshot_estimated_share, request.accepted_departure_start,
            request.accepted_pickup_at, request.locked_share,
            request.no_liability_until_trip, ride.owner_id
     FROM ride_join_requests request
     JOIN rides ride ON ride.id = request.ride_id
     WHERE request.rider_id = $1 AND request.status IN ('pending', 'needs_reconfirmation')
     ORDER BY request.ride_id, request.id
     FOR NO KEY UPDATE OF request`,
    [riderId],
  );
  for (const request of rows) {
    await transitionRequest(client, request, 'withdrawn', 'rider_suspended', now);
    await notify(
      client,
      request.owner_id,
      'join_request_update',
      'A rider withdrew their request',
      'A pending ride request was withdrawn because the rider was suspended.',
      request.ride_id,
      now,
    );
  }
}

async function acceptedRideConflict(
  client: PoolClient,
  riderId: string,
  ride: RideRow,
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM ride_join_requests request
     JOIN rides accepted_ride ON accepted_ride.id = request.ride_id
     WHERE request.rider_id = $1 AND request.status = 'accepted'
       AND request.ride_id <> $2
       AND abs(extract(epoch FROM (accepted_ride.departure_start - $3))) < $4
     LIMIT 1`,
    [riderId, ride.id, ride.departure_start, REQUEST_CONFLICT_WINDOW_MS / 1000],
  );
  return rows.length > 0;
}

async function withdrawConflictingRequests(
  client: PoolClient,
  riderId: string,
  acceptedRide: RideRow,
  acceptedRequestId: string,
  now: Date,
) {
  const { rows } = await client.query<{
    id: string;
    ride_id: string;
    owner_id: string;
    status: JoinRequestState;
  }>(
    `SELECT request.id, request.ride_id, ride.owner_id, request.status
     FROM ride_join_requests request
     JOIN rides ride ON ride.id = request.ride_id
     WHERE request.rider_id = $1 AND request.id <> $2
       AND request.status IN ('pending', 'needs_reconfirmation')
       AND abs(extract(epoch FROM (ride.departure_start - $3))) < $4
     FOR NO KEY UPDATE OF request`,
    [riderId, acceptedRequestId, acceptedRide.departure_start, REQUEST_CONFLICT_WINDOW_MS / 1000],
  );
  for (const request of rows) {
    await client.query(
      `UPDATE ride_join_requests
       SET status = 'withdrawn', reason_code = 'conflicting_ride_accepted',
           decided_at = $2, updated_at = $2
       WHERE id = $1`,
      [request.id, now],
    );
    await recordEvent(
      client,
      request.id,
      request.status,
      'withdrawn',
      'conflicting_ride_accepted',
      {},
      now,
    );
    await notify(
      client,
      request.owner_id,
      'join_request_update',
      'A pending request was withdrawn',
      'The rider was accepted on a ride departing within two hours.',
      request.ride_id,
      now,
    );
  }
}

export async function cancelRideForOwner(
  client: PoolClient,
  rideId: string,
  ownerId: string,
  now: Date,
): Promise<JoinRequestResult> {
  if (!(await lockUser(client, ownerId))) return requestFailure('not_rider');
  const ride = await lockRide(client, rideId);
  if (!ride) return requestFailure('not_found');
  if (ride.owner_id !== ownerId) return requestFailure('not_owner');
  if (ride.state !== 'scheduled') return requestFailure('ride_closed');
  if (now.getTime() >= ride.departure_start.getTime()) return requestFailure('trip_started');

  await client.query(`UPDATE rides SET state = 'cancelled', cancelled_at = $2 WHERE id = $1`, [
    rideId,
    now,
  ]);
  const { rows } = await client.query<RequestRow>(
    `${ACTIVE_REQUEST_SQL}
     WHERE ride_id = $1 AND status = ANY($2::text[])
     ORDER BY submitted_at, id FOR NO KEY UPDATE`,
    [rideId, [...ACTIVE_JOIN_REQUEST_STATES]],
  );
  for (const request of rows) {
    await client.query(
      `UPDATE ride_join_requests
       SET status = 'ride_cancelled', reason_code = 'owner_cancelled',
           locked_share = NULL, decided_at = $2, updated_at = $2
       WHERE id = $1`,
      [request.id, now],
    );
    await recordEvent(
      client,
      request.id,
      request.status,
      'ride_cancelled',
      'owner_cancelled',
      {},
      now,
    );
    await notify(
      client,
      request.rider_id,
      'join_request_update',
      'Ride cancelled',
      'The ride owner cancelled the ride. You owe no fare for this ride.',
      rideId,
      now,
    );
  }
  await client.query('UPDATE riders SET locked_share = NULL WHERE ride_id = $1', [rideId]);
  await client.query(
    'UPDATE ride_chats SET closed_at = COALESCE(closed_at, $2) WHERE ride_id = $1',
    [rideId, now],
  );
  return { kind: 'cancelled', rideId };
}

export type RideEdit = {
  departureStart?: Date;
  departureEnd?: Date;
  capacity?: number;
  expectedTotalFare?: number;
  direction?: 'to_hub' | 'from_hub';
  hubId?: string;
};

export async function editRideForOwner(
  client: PoolClient,
  rideId: string,
  ownerId: string,
  edit: RideEdit,
  confirmAffectedRiders: boolean,
  now: Date,
): Promise<JoinRequestResult> {
  if (!(await lockUser(client, ownerId))) return requestFailure('not_rider');
  const ride = await lockRide(client, rideId);
  if (!ride) return requestFailure('not_found');
  if (ride.owner_id !== ownerId) return requestFailure('not_owner');
  if (ride.state !== 'scheduled' || rideIsLocked(ride, now)) return requestFailure('ride_locked');

  const departureStart = edit.departureStart ?? ride.departure_start;
  const departureEnd = edit.departureEnd ?? ride.departure_end;
  const capacity = edit.capacity ?? ride.capacity_snapshot;
  const expectedTotalFare = edit.expectedTotalFare ?? ride.expected_total_fare;
  const direction = edit.direction ?? ride.direction;
  const hubId =
    edit.hubId ??
    (await client.query<{ hub_id: string }>('SELECT hub_id FROM rides WHERE id = $1', [rideId]))
      .rows[0]?.hub_id;
  if (!hubId) return requestFailure('not_found');
  if (
    departureStart.getTime() >= departureEnd.getTime() ||
    lockTime(departureStart).getTime() <= now.getTime()
  ) {
    return requestFailure(
      'ride_closed',
      'The updated departure window must be valid and leave time before lock.',
    );
  }
  if (!Number.isInteger(expectedTotalFare) || expectedTotalFare < 1 || expectedTotalFare > 50_000) {
    return requestFailure('ride_closed', 'The expected fare must be between ₹1 and ₹50,000.');
  }

  const beforeSeats = await seatsForRide(client, rideId);
  if (!Number.isInteger(capacity) || capacity < beforeSeats.length) {
    return requestFailure('ride_full', 'Capacity cannot be lower than the confirmed occupants.');
  }
  const vehicle = await client.query<{ capacity: number }>(
    `SELECT capacity FROM vehicle_types WHERE id = (
       SELECT vehicle_type_id FROM rides WHERE id = $1
     )`,
    [rideId],
  );
  if (!vehicle.rows[0] || capacity > vehicle.rows[0].capacity) {
    return requestFailure('ride_full', 'Capacity cannot exceed the configured vehicle capacity.');
  }
  const destination = await client.query(
    `SELECT 1 FROM locations WHERE id = $1 AND type = 'transport_hub' AND is_active = true`,
    [hubId],
  );
  if (destination.rows.length === 0) {
    return requestFailure('invalid_pickup', 'Choose an active transport hub.');
  }

  const hasMaterialEdit =
    departureStart.getTime() !== ride.departure_start.getTime() ||
    departureEnd.getTime() !== ride.departure_end.getTime() ||
    capacity !== ride.capacity_snapshot ||
    expectedTotalFare !== ride.expected_total_fare ||
    direction !== ride.direction ||
    hubId !==
      (await client.query<{ hub_id: string }>('SELECT hub_id FROM rides WHERE id = $1', [rideId]))
        .rows[0]?.hub_id;
  if (!hasMaterialEdit) return { kind: 'edited', rideId };

  const accepted = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ride_join_requests
     WHERE ride_id = $1 AND status = 'accepted'`,
    [rideId],
  );
  if ((accepted.rows[0]?.count ?? 0) > 0 && !confirmAffectedRiders) {
    return {
      kind: 'confirmation_required',
      detail: 'This change affects confirmed riders. Confirm it to save and notify them.',
    };
  }

  const ownerConflict = await client.query(
    `SELECT 1 FROM rides
     WHERE owner_id = $1 AND id <> $2
       AND state IN ('scheduled', 'pickup_in_progress', 'in_transit')
       AND departure_start < $4 AND departure_end > $3
     LIMIT 1`,
    [ownerId, rideId, departureStart, departureEnd],
  );
  if (ownerConflict.rows.length > 0) {
    return requestFailure('departure_conflict', 'This departure overlaps another ride you own.');
  }

  await client.query(
    `UPDATE rides
     SET departure_start = $2, departure_end = $3, capacity_snapshot = $4,
         expected_total_fare = $5, direction = $6, hub_id = $7
     WHERE id = $1`,
    [rideId, departureStart, departureEnd, capacity, expectedTotalFare, direction, hubId],
  );
  const updatedRide: RideRow = {
    ...ride,
    departure_start: departureStart,
    departure_end: departureEnd,
    capacity_snapshot: capacity,
    expected_total_fare: expectedTotalFare,
    direction,
  };
  const { rows: riders } = await client.query<{ rider_id: string }>(
    `SELECT rider_id FROM ride_join_requests
     WHERE ride_id = $1 AND status = 'accepted'`,
    [rideId],
  );
  for (const rider of riders) {
    await notify(
      client,
      rider.rider_id,
      'join_request_update',
      'Ride details changed',
      'The owner changed the ride details. Review the updated departure, destination, and fare on the ride page.',
      rideId,
      now,
    );
  }
  await notifyShareChanges(
    client,
    updatedRide,
    beforeSeats,
    beforeSeats,
    now,
    ride.expected_total_fare,
  );
  await refreshAcceptedItinerary(client, updatedRide, now, beforeSeats);
  await refreshPendingSnapshots(client, updatedRide, now, beforeSeats);
  return { kind: 'edited', rideId };
}

export async function lockRideForOwner(
  client: PoolClient,
  rideId: string,
  ownerId: string,
  now: Date,
): Promise<JoinRequestResult> {
  if (!(await lockUser(client, ownerId))) return requestFailure('not_rider');
  const ride = await lockRide(client, rideId);
  if (!ride) return requestFailure('not_found');
  if (ride.owner_id !== ownerId) return requestFailure('not_owner');
  if (ride.state !== 'scheduled') return requestFailure('ride_closed');
  if (ride.locked_at) return requestFailure('ride_locked');
  await client.query('UPDATE rides SET locked_at = $2 WHERE id = $1', [rideId, now]);
  const seats = await seatsForRide(client, rideId);
  const shares = splitFare(ride.expected_total_fare, seats.length);
  for (const [index, seat] of seats.entries()) {
    await client.query(
      `UPDATE riders SET locked_share = $3
       WHERE ride_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [rideId, seat.user_id, shares[index]],
    );
  }
  await client.query(
    `UPDATE ride_join_requests request
     SET locked_share = seat.locked_share
     FROM riders seat
     WHERE request.ride_id = $1 AND request.status = 'accepted'
       AND request.rider_id = seat.user_id AND seat.ride_id = request.ride_id
       AND seat.left_at IS NULL`,
    [rideId],
  );
  await expireWaitingRequests(client, rideId, now);
  for (const seat of seats) {
    if (seat.user_id !== ownerId) {
      await notify(
        client,
        seat.user_id,
        'join_request_update',
        'Ride locked',
        'The pool membership and fare shares are now fixed.',
        rideId,
        now,
      );
    }
  }
  await notify(
    client,
    ownerId,
    'join_request_update',
    'Ride locked',
    'The pool membership and fare shares are now fixed.',
    rideId,
    now,
  );
  return { kind: 'locked', rideId };
}

export async function expireDueJoinRequests(now = new Date()): Promise<void> {
  const due = await poolQueryDueRides(now);
  for (const rideId of due) {
    const client = await poolConnect();
    try {
      await client.query('BEGIN');
      const ride = await lockRide(client, rideId);
      if (ride && ride.state === 'scheduled' && rideIsLocked(ride, now)) {
        await lockRideAt(client, ride, now);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function poolQueryDueRides(now: Date): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM rides
     WHERE state = 'scheduled' AND departure_start <= $1::timestamptz + interval '60 minutes'
       AND (locked_at IS NULL OR EXISTS (
         SELECT 1 FROM ride_join_requests request
         WHERE request.ride_id = rides.id
           AND request.status IN ('pending', 'needs_reconfirmation')
       ))
     ORDER BY departure_start, id LIMIT 100`,
    [now],
  );
  return rows.map((row) => row.id);
}

async function poolConnect() {
  return pool.connect();
}
