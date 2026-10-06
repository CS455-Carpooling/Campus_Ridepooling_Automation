import 'server-only';
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
 * Data for the admin home page. SOS incidents, complaints and AI review do not
 * exist yet, so every count is null ("not available yet"), not a false zero.
 */
export async function getAdminHome(): Promise<AdminHomeData> {
  return { openIncidents: null, complaintsToReview: null, recommendationsToDecide: null };
}
