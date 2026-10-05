/**
 * Names, labels and time rules for a ride that already exists: its state, its
 * lock time and who may see it. Pure functions only, so the ride page, the
 * ride lists and later APIs all apply the same rules.
 */
import { RIDE_RULES, type Direction } from './ride-rules';

/** The states in rides.state (schema.sql), as in the D1 class diagram's TripState. */
export const RIDE_STATES = [
  'scheduled',
  'pickup_in_progress',
  'in_transit',
  'completed',
  'cancelled',
] as const;

export type RideState = (typeof RIDE_STATES)[number];

/** Text labels for each state (FR-RD-10.1, NFR-RO-USE-04: never colour alone). */
export const rideStateLabels: Record<RideState, string> = {
  scheduled: 'Scheduled',
  pickup_in_progress: 'Pickup in progress',
  in_transit: 'In transit',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const directionLabels: Record<Direction, string> = {
  to_hub: 'Leaving campus',
  from_hub: 'Coming to campus',
};

/** How the people on a ride relate to it: whoever offered it, someone on it, or anyone else. */
export type ViewerRole = 'owner' | 'rider' | 'visitor';

/**
 * A ride's name: "To Kanpur Central" or "From Kanpur Central". It names the hub
 * only, because the people on a ride may each use a different hall.
 */
export function rideTitle(direction: Direction, hubName: string): string {
  return direction === 'to_hub' ? `To ${hubName}` : `From ${hubName}`;
}

/** What each person's campus place is on this ride: where they are picked up or dropped off. */
export function campusPlaceLabel(direction: Direction): string {
  return direction === 'to_hub' ? 'Pickup' : 'Drop-off';
}

// A ride locks an hour before it leaves (P-06); the same hour is the minimum lead when creating one.
const LOCK_LEAD_MINUTES = RIDE_RULES.minLeadMinutes;

/** When the ride locks: the group and the shares are fixed from then on. */
export function lockTime(departureStart: Date): Date {
  return new Date(departureStart.getTime() - LOCK_LEAD_MINUTES * 60_000);
}

export function isLocked(departureStart: Date, now: Date): boolean {
  return now.getTime() >= lockTime(departureStart).getTime();
}

/** Whether others can still ask to join: scheduled and not yet locked (FR-RD-03.2). */
export function isOpenToJoin(state: RideState, departureStart: Date, now: Date): boolean {
  return state === 'scheduled' && !isLocked(departureStart, now);
}

/**
 * Who may see a ride (NFR-RD-09, enforced on the server): its owner and riders
 * always; anyone else only while it is open to join, so that they can decide
 * whether to ask. Every other ride is treated as if it did not exist.
 */
export function canViewRide(
  role: ViewerRole,
  state: RideState,
  departureStart: Date,
  now: Date,
): boolean {
  return role !== 'visitor' || isOpenToJoin(state, departureStart, now);
}
