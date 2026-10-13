import 'server-only';
import type { AdminActor, AdminOutcome } from './admin-activity';
import { pool } from './db';
import {
  getHistoricalRides,
  getUpcomingRides,
  type HistoricalRide,
  type UpcomingRide,
} from './ride-view';
import { isUuid } from './ids';

export type { HistoricalRide, UpcomingRide };

export type RequestStatus =
  | 'pending'
  | 'needs_reconfirmation'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired'
  | 'ride_cancelled'
  | 'left'
  | 'no_show'
  | 'completed';

export type RequestHistoryEvent = {
  id: string;
  previousStatus: RequestStatus | null;
  newStatus: RequestStatus;
  reasonCode: string | null;
  changedAt: string;
};

export type RiderJoinRequest = {
  requestId: string;
  rideId: string;
  destination: string;
  departure: string;
  pickupPoint: string;
  status: RequestStatus;
  estimatedShare: number;
  reasonCode: string | null;
  submittedAt: string;
  updatedAt: string;
  history: RequestHistoryEvent[];
};

/** A join request waiting for someone's decision. */
export type WaitingRequest =
  | {
      kind: 'sent';
      requestId: string;
      rideId: string;
      destination: string;
      departure: string;
      state: 'pending' | 'needs_reconfirmation';
    }
  | {
      kind: 'received';
      requestId: string;
      rideId: string;
      destination: string;
      departure: string;
      riderName: string;
      state: 'pending' | 'needs_reconfirmation';
    };

export type StudentHomeData = {
  upcoming: UpcomingRide[];
  history: HistoricalRide[];
  waiting: WaitingRequest[];
  joinRequests: RiderJoinRequest[];
};

export type AdminActivity = {
  id: string;
  action: string;
  actor: AdminActor;
  adminName: string | null;
  subject: string | null;
  outcome: AdminOutcome;
  at: string;
};

export type AdminHomeData = {
  /** SOS alerts not closed yet (CS455-65, FR-RD-15). */
  openIncidents: number | null;
  /** Of those, the ones no admin has acknowledged. */
  unacknowledgedIncidents: number;
  /** Submitted or under review, chat reports included. */
  complaintsToReview: number;
  safetyComplaintsToReview: number;
  recommendationsToDecide: number;
  ridersSuspended: number;
  recentActions: AdminActivity[];
};

type JoinRequestRow = {
  request_id: string;
  ride_id: string;
  destination: string;
  departure: Date | string;
  pickup_point: string;
  status: RequestStatus;
  estimated_share: number | string;
  reason_code: string | null;
  submitted_at: Date | string;
  updated_at: Date | string;
};

type RequestHistoryRow = {
  id: string;
  request_id: string;
  previous_status: RequestStatus | null;
  new_status: RequestStatus;
  reason_code: string | null;
  changed_at: Date | string;
};

const RIDER_JOIN_REQUESTS_SQL = `
  SELECT
    jr.id AS request_id,
    jr.ride_id,
    CASE
      WHEN r.direction = 'to_hub'
        THEN CONCAT(pickup.name, ' → ', hub.name)
      WHEN r.direction = 'from_hub'
        THEN CONCAT(hub.name, ' → ', pickup.name)
      ELSE CONCAT(hub.name, ' → ', pickup.name)
    END AS destination,
    jr.snapshot_departure_start AS departure,
    pickup.name AS pickup_point,
    jr.status,
    jr.snapshot_estimated_share AS estimated_share,
    jr.reason_code,
    jr.submitted_at,
    jr.updated_at
  FROM ride_join_requests jr
  JOIN rides r
    ON r.id = jr.ride_id
  JOIN locations hub
    ON hub.id = r.hub_id
  JOIN locations pickup
    ON pickup.id = jr.pickup_location_id
  WHERE jr.rider_id = $1
  ORDER BY jr.submitted_at DESC, jr.id DESC
`;

const RIDER_REQUEST_HISTORY_SQL = `
  SELECT
    h.id,
    h.request_id,
    h.from_status AS previous_status,
    h.to_status AS new_status,
    h.reason_code,
    h.created_at AS changed_at
  FROM ride_join_request_events h
  JOIN ride_join_requests jr ON jr.id = h.request_id
  WHERE jr.rider_id = $1
  ORDER BY h.created_at ASC, h.id ASC
`;

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRequestHistory(row: RequestHistoryRow): RequestHistoryEvent {
  return {
    id: row.id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    reasonCode: row.reason_code,
    changedAt: toIsoString(row.changed_at),
  };
}

/**
 * Data for the student dashboard: rides and join requests sent or received.
 */
export async function getStudentHome(
  userId: string,
  now: Date = new Date(),
): Promise<StudentHomeData> {
  const [upcoming, history, waiting, requestsResult, historyResult] = await Promise.all([
    getUpcomingRides(userId, now),
    getHistoricalRides(userId, now),
    getWaitingRequests(userId),
    pool.query<JoinRequestRow>(RIDER_JOIN_REQUESTS_SQL, [userId]),
    pool.query<RequestHistoryRow>(RIDER_REQUEST_HISTORY_SQL, [userId]),
  ]);

  const eventsByRequest = new Map<string, RequestHistoryEvent[]>();

  for (const row of historyResult.rows) {
    const events = eventsByRequest.get(row.request_id) ?? [];
    events.push(mapRequestHistory(row));
    eventsByRequest.set(row.request_id, events);
  }

  const joinRequests: RiderJoinRequest[] = requestsResult.rows.map((row) => ({
    requestId: row.request_id,
    rideId: row.ride_id,
    destination: row.destination,
    departure: toIsoString(row.departure),
    pickupPoint: row.pickup_point,
    status: row.status,
    estimatedShare: Number(row.estimated_share),
    reasonCode: row.reason_code,
    submittedAt: toIsoString(row.submitted_at),
    updatedAt: toIsoString(row.updated_at),
    history: eventsByRequest.get(row.request_id) ?? [],
  }));

  return {
    upcoming,
    history,
    waiting,
    joinRequests,
  };
}

type WaitingRequestRow = {
  kind: 'sent' | 'received';
  request_id: string;
  ride_id: string;
  destination: string;
  departure: Date;
  rider_name: string | null;
  status: 'pending' | 'needs_reconfirmation';
};

async function getWaitingRequests(userId: string): Promise<WaitingRequest[]> {
  if (!isUuid(userId)) return [];
  const { rows } = await pool.query<WaitingRequestRow>(
    `SELECT 'sent'::text AS kind, request.id AS request_id, ride.id AS ride_id,
            hub.name AS destination, ride.departure_start AS departure, NULL::text AS rider_name,
            request.status
     FROM ride_join_requests request
     JOIN rides ride ON ride.id = request.ride_id
     JOIN locations hub ON hub.id = ride.hub_id
     WHERE request.rider_id = $1 AND request.status IN ('pending', 'needs_reconfirmation')
     UNION ALL
     SELECT 'received'::text, request.id, ride.id, hub.name, ride.departure_start,
            COALESCE(profile.display_name, rider.full_name), request.status
     FROM ride_join_requests request
     JOIN rides ride ON ride.id = request.ride_id
     JOIN locations hub ON hub.id = ride.hub_id
     JOIN users rider ON rider.id = request.rider_id
     LEFT JOIN user_profiles profile ON profile.user_id = rider.id
     WHERE ride.owner_id = $1 AND request.status IN ('pending', 'needs_reconfirmation')
     ORDER BY departure, request_id
     LIMIT 50`,
    [userId],
  );
  return rows.map((row) => {
    return row.kind === 'sent'
      ? {
          kind: 'sent',
          requestId: row.request_id,
          rideId: row.ride_id,
          destination: row.destination,
          departure: row.departure.toISOString(),
          state: row.status,
        }
      : {
          kind: 'received',
          requestId: row.request_id,
          rideId: row.ride_id,
          destination: row.destination,
          departure: row.departure.toISOString(),
          riderName: row.rider_name ?? 'Rider',
          state: row.status,
        };
  });
}

const ADMIN_COUNTS_SQL = `
  SELECT
    count(*) FILTER (WHERE status IN ('submitted', 'under_review'))::int AS complaints,
    count(*) FILTER (WHERE status IN ('submitted', 'under_review') AND category = 'safety')::int
      AS safety,
    (SELECT count(DISTINCT a.complaint_id)::int
       FROM complaint_ai_analyses a
       JOIN complaints c ON c.id = a.complaint_id AND c.status <> 'resolved'
       WHERE a.outcome = 'ai_validated' AND a.recommended_action <> 'none'
         AND NOT EXISTS (SELECT 1 FROM ai_enforcement_decisions d WHERE d.analysis_id = a.id))
      AS recommendations,
    (SELECT count(DISTINCT user_id)::int FROM active_rider_suspensions) AS suspended,
    (SELECT count(*)::int FROM sos_incidents WHERE status <> 'closed') AS incidents,
    (SELECT count(*)::int FROM sos_incidents WHERE status = 'open') AS unacknowledged
  FROM complaints`;

const RECENT_ACTIONS_SQL = `
  SELECT l.id, l.action, l.actor_type, u.full_name AS admin_name, l.outcome, l.created_at,
    CASE l.entity_type
      WHEN 'user' THEN (SELECT full_name FROM users WHERE id::text = l.entity_id)
      WHEN 'vehicle_type' THEN (SELECT name FROM vehicle_types WHERE id = l.entity_id)
      WHEN 'location' THEN (SELECT name FROM locations WHERE id = l.entity_id)
      WHEN 'complaint' THEN (SELECT reference FROM complaints WHERE id::text = l.entity_id)
      WHEN 'sos_incident' THEN (SELECT reference FROM sos_incidents WHERE id::text = l.entity_id)
      WHEN 'chat_report' THEN l.entity_id
    END AS subject
  FROM admin_audit_log l
  LEFT JOIN users u ON u.id = l.admin_id
  ORDER BY l.created_at DESC, l.id DESC
  LIMIT 10`;

type CountsRow = {
  complaints: number;
  safety: number;
  recommendations: number;
  suspended: number;
  incidents: number;
  unacknowledged: number;
};

type ActivityRow = {
  id: string;
  action: string;
  actor_type: AdminActor;
  admin_name: string | null;
  outcome: AdminOutcome;
  created_at: Date;
  subject: string | null;
};

/**
 * Data for the admin home page (CS455-49): SOS alerts not closed (CS455-65), the open complaints
 * (chat reports are complaints too), the AI recommendations waiting for a decision, the riders
 * suspended now, and the latest admin actions.
 */
export async function getAdminHome(): Promise<AdminHomeData> {
  const [counts, recent] = await Promise.all([
    pool.query<CountsRow>(ADMIN_COUNTS_SQL),
    pool.query<ActivityRow>(RECENT_ACTIONS_SQL),
  ]);

  const row = counts.rows[0];

  return {
    openIncidents: row?.incidents ?? 0,
    unacknowledgedIncidents: row?.unacknowledged ?? 0,
    complaintsToReview: row?.complaints ?? 0,
    safetyComplaintsToReview: row?.safety ?? 0,
    recommendationsToDecide: row?.recommendations ?? 0,
    ridersSuspended: row?.suspended ?? 0,
    recentActions: recent.rows.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor: entry.actor_type,
      adminName: entry.admin_name,
      subject: entry.subject,
      outcome: entry.outcome,
      at: entry.created_at.toISOString(),
    })),
  };
}
