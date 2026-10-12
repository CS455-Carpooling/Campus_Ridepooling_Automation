/**
 * Rules for a ride under way (CS455-60: FR-RO-09, FR-RO-10, FR-RD-07.5, FR-RD-10): which state
 * comes next and who moves it, what the owner may record about each seat at pickup, the no-show
 * grace period, checking in, and who may still leave. Shared by the trip APIs, the ride page and
 * the admin pages, so they always agree; the database enforces the absolute ones again
 * (schema.sql). Pure functions only.
 */
import { isUuid } from './ids';
import { isLocked, type RideState, type ViewerRole } from './ride-status';

/** The trip is under way in these states (FR-RD-10.1). */
export const ACTIVE_TRIP_STATES = ['pickup_in_progress', 'in_transit'] as const;

export type ActiveTripState = (typeof ACTIVE_TRIP_STATES)[number];

/** Nobody may leave once the trip is under way (FR-RD-07.5), and SOS is offered (FR-RD-15.1). */
export function isTripActive(state: RideState): state is ActiveTripState {
  return (ACTIVE_TRIP_STATES as readonly string[]).includes(state);
}

export const TRIP_RULES = {
  /** P-19 (P-03 for owners): a no-show may be recorded this long after the rider's pickup time. */
  noShowGraceMinutes: 5,
} as const;

const MINUTE = 60_000;

/** The states an owner moves a ride to: pickup, then optionally in transit, then completed. */
export const TRIP_TARGETS = ['pickup_in_progress', 'in_transit', 'completed'] as const;

export type TripTarget = (typeof TRIP_TARGETS)[number];

// FR-RO-09.1 (pickup from a locked Scheduled ride), FR-RD-10.1 (In Transit), FR-RO-09.4 (completed
// from Pickup in Progress, or from In Transit when the owner took that step).
const MOVES_FROM: Record<TripTarget, readonly RideState[]> = {
  pickup_in_progress: ['scheduled'],
  in_transit: ['pickup_in_progress'],
  completed: ['pickup_in_progress', 'in_transit'],
};

/** Why a ride cannot move to the state asked for. */
export type TripRefusal =
  'not_owner' | 'cancelled' | 'completed' | 'not_locked' | 'not_started' | 'invalid_transition';

export const tripRefusalMessages: Record<TripRefusal, string> = {
  not_owner: 'Only the ride owner can change the trip.',
  cancelled: 'This ride was cancelled.',
  completed: 'This ride is already completed.',
  not_locked: 'Pickup can start once the ride locks, an hour before departure.',
  not_started: 'Start pickup before completing the ride.',
  invalid_transition: 'The trip cannot move to that step from where it is now.',
};

/**
 * Why `role` may not move this ride from `state` to `to` now, or null when they may. Only the
 * owner moves a ride, never a cancelled or completed one, and pickup starts only once the ride is
 * locked (FR-RO-09.1). Asking for the state the ride is already in is not refused: the caller
 * treats it as done, so a double tap does no harm.
 */
export function tripTransitionRefusal(
  role: ViewerRole,
  state: RideState,
  to: TripTarget,
  departureStart: Date,
  now: Date,
): TripRefusal | null {
  if (role !== 'owner') return 'not_owner';
  if (state === to) return null;
  if (state === 'cancelled') return 'cancelled';
  if (state === 'completed') return 'completed';
  if (!MOVES_FROM[to].includes(state)) {
    return to === 'completed' ? 'not_started' : 'invalid_transition';
  }
  if (to === 'pickup_in_progress' && !isLocked(departureStart, now)) return 'not_locked';
  return null;
}

/** A moment as the server reads it or as the browser receives it. */
type Moment = Date | string | null;

/** What has happened to one seat. The owner's seat never checks in, arrives or misses pickup. */
export type SeatProgress = {
  leftAt: Moment;
  checkedInAt: Moment;
  arrivedAt: Moment;
  noShowAt: Moment;
};

export type SeatStatus = 'left' | 'no_show' | 'arrived' | 'checked_in' | 'waiting';

/** Where a seat stands at pickup, the most final fact first. */
export function seatStatus(seat: SeatProgress): SeatStatus {
  if (seat.leftAt) return 'left';
  if (seat.noShowAt) return 'no_show';
  if (seat.arrivedAt) return 'arrived';
  if (seat.checkedInAt) return 'checked_in';
  return 'waiting';
}

/** In words, never by colour alone (NFR-RO-USE-04). */
export const seatStatusLabels: Record<SeatStatus, string> = {
  left: 'Left the ride',
  no_show: 'No-show',
  arrived: 'Arrived',
  checked_in: 'At the pickup point',
  waiting: 'Not arrived yet',
};

/**
 * Whether a seat is still in the pool: not left and not a no-show (FR-RO-10.2). The fare is split
 * between these seats, and only they rate and are rated (FR-RO-12.2).
 */
export function isActiveSeat(seat: Pick<SeatProgress, 'leftAt' | 'noShowAt'>): boolean {
  return !seat.leftAt && !seat.noShowAt;
}

/** When a no-show may be recorded for a rider picked up at `pickupTime` (P-19). */
export function noShowAvailableAt(pickupTime: Date): Date {
  return new Date(pickupTime.getTime() + TRIP_RULES.noShowGraceMinutes * MINUTE);
}

/** One seat as the owner's pickup actions see it. */
export type PickupSeat = Pick<SeatProgress, 'leftAt' | 'arrivedAt' | 'noShowAt'> & {
  isOwner: boolean;
};

/** Why the owner cannot record this about a seat now. */
export type SeatRefusal =
  | 'not_owner'
  | 'not_in_pickup'
  | 'owner_seat'
  | 'not_on_ride'
  | 'no_show'
  | 'arrived'
  | 'grace_period'
  | 'not_open';

export const seatRefusalMessages: Record<SeatRefusal, string> = {
  not_owner: 'Only the ride owner can mark arrivals and no-shows.',
  not_in_pickup: 'Arrivals and no-shows are marked while pickup is in progress.',
  owner_seat: "That is the owner's own seat.",
  not_on_ride: 'That person is no longer on this ride.',
  no_show: 'That rider was marked as a no-show, which cannot be undone.',
  arrived: 'That rider was marked as arrived. Undo Arrived first.',
  grace_period: "A no-show can be marked only 5 minutes after the rider's pickup time.",
  not_open: 'You can say you are at the pickup point once the ride locks, until the trip starts.',
};

/** Why the owner may not mark this seat arrived (or undo it) now (FR-RO-09.3), or null. */
export function arrivalRefusal(
  role: ViewerRole,
  state: RideState,
  seat: PickupSeat,
): SeatRefusal | null {
  if (role !== 'owner') return 'not_owner';
  if (state !== 'pickup_in_progress') return 'not_in_pickup';
  if (seat.isOwner) return 'owner_seat';
  if (seat.leftAt) return 'not_on_ride';
  if (seat.noShowAt) return 'no_show';
  return null;
}

/**
 * Why the owner may not mark this seat a no-show now, or null when they may (FR-RO-10.1): only
 * during pickup, only for a rider still on the ride who has not been marked arrived, and only from
 * 5 minutes after the rider's pickup time. A seat already marked is not refused: the caller treats
 * it as done.
 */
export function noShowRefusal(
  role: ViewerRole,
  state: RideState,
  seat: PickupSeat,
  pickupTime: Date,
  now: Date,
): SeatRefusal | null {
  if (role !== 'owner') return 'not_owner';
  if (state !== 'pickup_in_progress') return 'not_in_pickup';
  if (seat.isOwner) return 'owner_seat';
  if (seat.leftAt) return 'not_on_ride';
  if (seat.noShowAt) return null;
  if (seat.arrivedAt) return 'arrived';
  if (now.getTime() < noShowAvailableAt(pickupTime).getTime()) return 'grace_period';
  return null;
}

/**
 * Why this rider may not say they are at their pickup point now (FR-RD-10.4), or null: from the
 * lock until the trip starts, for a rider still on the ride. Checking in twice is not refused.
 */
export function checkInRefusal(
  state: RideState,
  departureStart: Date,
  now: Date,
  seat: Pick<PickupSeat, 'isOwner' | 'leftAt' | 'noShowAt'>,
): SeatRefusal | null {
  if (seat.isOwner) return 'owner_seat';
  if (seat.leftAt) return 'not_on_ride';
  if (seat.noShowAt) return 'no_show';
  const lockedAndWaiting = state === 'scheduled' && isLocked(departureStart, now);
  if (!lockedAndWaiting && state !== 'pickup_in_progress') return 'not_open';
  return null;
}

/**
 * Whether a rider may leave a ride in this state: only while it is scheduled (FR-RD-07.2 to 07.4),
 * never once pickup has started (FR-RD-07.5). For the leave flow of the join-request story.
 */
export function canLeave(state: RideState): boolean {
  return state === 'scheduled';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const tripRequestMessages = {
  to: 'Choose the step to move the trip to.',
  occupantId: 'Choose a rider on this ride.',
  status: 'Choose Arrived, Not arrived or No-show.',
} as const;

/** The body of POST /api/rides/[id]/trip: `{ to }`. */
export function parseTripRequest(
  body: unknown,
): { ok: true; value: { to: TripTarget } } | { ok: false; errors: { to: string } } {
  const to = isRecord(body) ? body.to : undefined;
  if (typeof to === 'string' && (TRIP_TARGETS as readonly string[]).includes(to)) {
    return { ok: true, value: { to: to as TripTarget } };
  }
  return { ok: false, errors: { to: tripRequestMessages.to } };
}

export const ARRIVAL_STATUSES = ['arrived', 'not_arrived', 'no_show'] as const;

export type ArrivalStatus = (typeof ARRIVAL_STATUSES)[number];

export type ArrivalRequest = { occupantId: string; status: ArrivalStatus };

/**
 * The body of POST /api/rides/[id]/arrivals: `{ occupantId, status }`, where `occupantId` is the
 * seat (riders.id), never an account ID.
 */
export function parseArrivalRequest(
  body: unknown,
):
  | { ok: true; value: ArrivalRequest }
  | { ok: false; errors: Partial<Record<keyof ArrivalRequest, string>> } {
  const input = isRecord(body) ? body : {};
  const errors: Partial<Record<keyof ArrivalRequest, string>> = {};
  if (!isUuid(input.occupantId)) errors.occupantId = tripRequestMessages.occupantId;
  const status = input.status;
  if (typeof status !== 'string' || !(ARRIVAL_STATUSES as readonly string[]).includes(status)) {
    errors.status = tripRequestMessages.status;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      occupantId: (input.occupantId as string).toLowerCase(),
      status: status as ArrivalStatus,
    },
  };
}
