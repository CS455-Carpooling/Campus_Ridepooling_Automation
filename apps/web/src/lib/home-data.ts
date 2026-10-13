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
};

/** One entry of the audit log, as the admin home lists it (SYS-FR-45, SYS-NFR-12). */
export type AdminActivity = {
  id: string;
  /** The action code, for example `rider.warn`; see admin-activity.ts for the labels. */
  action: string;
  actor: AdminActor;
  /** The admin's name, when an admin made the change. */
  adminName: string | null;
  /** What the change was about, by name: a rider, a place, a vehicle type, a complaint. */
  subject: string | null;
  outcome: AdminOutcome;
  at: string;
};

/** The admin home (CS455-49): what needs attention, then the latest admin actions. */
export type AdminHomeData = {
  /** SOS alerts not closed yet (CS455-65, FR-RD-15). */
  openIncidents: number | null;
  /** Of those, the ones no admin has acknowledged. */
  unacknowledgedIncidents: number;
  /** Submitted or under review, chat reports included. */
  complaintsToReview: number;
  safetyComplaintsToReview: number;
  /** Open complaints with a validated AI recommendation that no admin has decided on. */
  recommendationsToDecide: number;
  ridersSuspended: number;
  /** The last 10 entries of the audit log, newest first. */
  recentActions: AdminActivity[];
};

/**
 * Data for the student dashboard: rides and join requests sent or received.
 */
export async function getStudentHome(
  userId: string,
  now: Date = new Date(),
): Promise<StudentHomeData> {
  const [upcoming, history, waiting] = await Promise.all([
    getUpcomingRides(userId, now),
    getHistoricalRides(userId, now),
    getWaitingRequests(userId),
  ]);
  return { upcoming, history, waiting };
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

// Names the subject of each entry from its own table; entity_id is text, so it never blocks
// deleting what it points to, and an entry about something since deleted has no name.
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
