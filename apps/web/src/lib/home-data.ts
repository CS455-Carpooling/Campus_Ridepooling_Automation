import 'server-only';
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

/** Counts for the admin queues; null while the feature behind a queue does not exist yet. */
export type AdminHomeData = {
  openIncidents: number | null;
  complaintsToReview: number | null;
  recommendationsToDecide: number | null;
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

/**
 * Data for the admin home page. Chat complaints are tracked here; SOS incidents
 * and AI review are not implemented yet, so their counts remain unavailable.
 */
export async function getAdminHome(): Promise<AdminHomeData> {
  const { rows } = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count
     FROM ride_chat_complaints
     WHERE status = 'open'`,
  );
  return {
    openIncidents: null,
    complaintsToReview: rows[0]?.count ?? 0,
    recommendationsToDecide: null,
  };
}
