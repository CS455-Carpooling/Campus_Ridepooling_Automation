import 'server-only';

/** A ride the student has a seat on (as a rider) or is offering (as the owner). */
export type UpcomingRide = {
  rideId: string;
  destination: string;
  /** ISO 8601 date and time. */
  departure: string;
  part: 'rider' | 'owner';
  seatsLeft: number;
};

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
 * Data for the student home page. The rides and join-request APIs do not exist
 * yet, so this returns empty lists; when they do, only this function changes.
 */
export async function getStudentHome(userId: string): Promise<StudentHomeData> {
  void userId;
  return { upcoming: [], waiting: [] };
}

/**
 * Data for the admin home page. SOS incidents, complaints and AI review do not
 * exist yet, so every count is null ("not available yet"), not a false zero.
 */
export async function getAdminHome(): Promise<AdminHomeData> {
  return { openIncidents: null, complaintsToReview: null, recommendationsToDecide: null };
}
