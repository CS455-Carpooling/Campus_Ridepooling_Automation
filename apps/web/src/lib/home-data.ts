import 'server-only';
import { getUpcomingRides, type UpcomingRide } from './ride-view';

export type { UpcomingRide };

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
  waiting: WaitingRequest[];
};

/** Counts for the admin queues; null while the feature behind a queue does not exist yet. */
export type AdminHomeData = {
  openIncidents: number | null;
  complaintsToReview: number | null;
  recommendationsToDecide: number | null;
};

/**
 * Data for the student home page: the rides they offered or joined, from the
 * database. Join requests do not exist yet, so nothing is waiting.
 */
export async function getStudentHome(
  userId: string,
  now: Date = new Date(),
): Promise<StudentHomeData> {
  return { upcoming: await getUpcomingRides(userId, now), waiting: [] };
}

/**
 * Data for the admin home page. SOS incidents, complaints and AI review do not
 * exist yet, so every count is null ("not available yet"), not a false zero.
 */
export async function getAdminHome(): Promise<AdminHomeData> {
  return { openIncidents: null, complaintsToReview: null, recommendationsToDecide: null };
}
