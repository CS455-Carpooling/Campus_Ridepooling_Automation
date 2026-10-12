export const JOIN_REQUEST_STATES = [
  'pending',
  'needs_reconfirmation',
  'accepted',
  'rejected',
  'withdrawn',
  'expired',
  'ride_cancelled',
  'left',
  'no_show',
  'completed',
] as const;

export type JoinRequestState = (typeof JOIN_REQUEST_STATES)[number];

export const ACTIVE_JOIN_REQUEST_STATES: readonly JoinRequestState[] = [
  'pending',
  'needs_reconfirmation',
  'accepted',
];

export const WAITING_JOIN_REQUEST_STATES: readonly JoinRequestState[] = [
  'pending',
  'needs_reconfirmation',
];

export const MAX_WAITING_REQUESTS = 3;
export const REQUEST_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const REQUEST_CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000;
export const REQUEST_DRIFT_MINUTES = 10;
export const REQUEST_DRIFT_SHARE_PERCENT = 20;

export type RequestSnapshot = {
  departureStart: Date;
  pickupAt: Date;
  estimatedShare: number;
};

export type JoinRequestInput = {
  pickupLocationId: string;
  idempotencyKey: string;
};

export function parseJoinRequestInput(
  body: Record<string, unknown>,
): { ok: true; value: JoinRequestInput } | { ok: false; error: string } {
  const pickupLocationId =
    typeof body.pickupLocationId === 'string' ? body.pickupLocationId.trim() : '';
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';

  if (pickupLocationId.length === 0 || pickupLocationId.length > 100) {
    return { ok: false, error: 'Choose a valid pickup point.' };
  }
  if (idempotencyKey.length === 0 || idempotencyKey.length > 200) {
    return { ok: false, error: 'A valid request key is required. Please try again.' };
  }
  return { ok: true, value: { pickupLocationId, idempotencyKey } };
}

export function hasMaterialRequestDrift(before: RequestSnapshot, after: RequestSnapshot): boolean {
  const timeThreshold = REQUEST_DRIFT_MINUTES * 60_000;
  const departureChanged =
    Math.abs(after.departureStart.getTime() - before.departureStart.getTime()) > timeThreshold;
  const pickupChanged =
    Math.abs(after.pickupAt.getTime() - before.pickupAt.getTime()) > timeThreshold;
  const shareIncreased =
    after.estimatedShare > before.estimatedShare &&
    (after.estimatedShare - before.estimatedShare) * 100 >
      before.estimatedShare * REQUEST_DRIFT_SHARE_PERCENT;
  return departureChanged || pickupChanged || shareIncreased;
}

export function hasDepartureConflict(first: Date, second: Date): boolean {
  return Math.abs(first.getTime() - second.getTime()) < REQUEST_CONFLICT_WINDOW_MS;
}

export function isJoinRequestState(value: unknown): value is JoinRequestState {
  return typeof value === 'string' && JOIN_REQUEST_STATES.includes(value as JoinRequestState);
}
