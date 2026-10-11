import 'server-only';
import type { AdminActor, AdminOutcome } from './admin-activity';
import { pool } from './db';
import {
  getHistoricalRides,
  getUpcomingRides,
  type HistoricalRide,
  type UpcomingRide,
} from './ride-view';

export type { HistoricalRide, UpcomingRide };

/** A join request waiting for someone's decision. */
export type WaitingRequest =
  | {
      kind: 'sent';
      requestId: string;
      rideId: string;
      destination: string;
      departure: string;
    }
  | {
      kind: 'received';
      requestId: string;
      rideId: string;
      destination: string;
      departure: string;
      riderName: string;
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
  /** SOS alerts (FR-RD-15) do not exist yet, so this stays null: "Not available yet". */
  openIncidents: number | null;
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
 * Data for the student dashboard: upcoming and historical rides they offered
 * or joined, from the database. Join requests do not exist yet, so none wait.
 */
export async function getStudentHome(
  userId: string,
  now: Date = new Date(),
): Promise<StudentHomeData> {
  const [upcoming, history] = await Promise.all([
    getUpcomingRides(userId, now),
    getHistoricalRides(userId, now),
  ]);
  return { upcoming, history, waiting: [] };
}

const ADMIN_COUNTS_SQL = `
  SELECT
    count(*) FILTER (WHERE status IN ('submitted', 'under_review'))::int AS complaints,
    count(*) FILTER (WHERE status IN ('submitted', 'under_review') AND category = 'safety')::int
      AS safety,
    (SELECT count(DISTINCT a.complaint_id)::int
       FROM complaint_ai_analyses a
       JOIN complaints c ON c.id = a.complaint_id AND c.status <> 'resolved'
       WHERE a.outcome = 'ai_validated'
         AND NOT EXISTS (SELECT 1 FROM ai_enforcement_decisions d WHERE d.analysis_id = a.id))
      AS recommendations,
    (SELECT count(DISTINCT user_id)::int FROM active_rider_suspensions) AS suspended
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
    END AS subject
  FROM admin_audit_log l
  LEFT JOIN users u ON u.id = l.admin_id
  ORDER BY l.created_at DESC, l.id DESC
  LIMIT 10`;

type CountsRow = { complaints: number; safety: number; recommendations: number; suspended: number };

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
 * Data for the admin home page (CS455-49): the open complaints (chat reports are complaints
 * too), the AI recommendations waiting for a decision, the riders suspended now, and the
 * latest admin actions. SOS incidents do not exist yet.
 */
export async function getAdminHome(): Promise<AdminHomeData> {
  const [counts, recent] = await Promise.all([
    pool.query<CountsRow>(ADMIN_COUNTS_SQL),
    pool.query<ActivityRow>(RECENT_ACTIONS_SQL),
  ]);
  const row = counts.rows[0];
  return {
    openIncidents: null,
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
