
/**
 * Shared rules for rider join requests.
 * Keep this file independent of the database and Next.js.
 */

export const RIDE_REQUEST_RULES = {
  maxActiveRequests: 3,
  minimumDepartureLeadMinutes: 60,
  minimumAcceptedRideGapMinutes: 120,
  idempotencyWindowHours: 24,
} as const;

export const ACTIVE_REQUEST_STATUSES = [
  'pending',
  'needs_reconfirmation',
] as const;

export const REQUEST_STATUSES = [
  ...ACTIVE_REQUEST_STATUSES,
  'accepted',
  'rejected',
  'withdrawn',
  'expired',
  'ride_cancelled',
] as const;

export type RideRequestStatus = (typeof REQUEST_STATUSES)[number];

export type JoinRequestInput = {
  pickupPointId: string;
  idempotencyKey: string;
};

export type JoinRequestValidation =
  | { ok: true; value: JoinRequestInput }
  | { ok: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validate a UUID received from an untrusted request. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Validate the request body.
 * Pickup point IDs are text IDs, such as "hall-9", not UUIDs.
 */
export function validateJoinRequest(
  input: Record<string, unknown>,
): JoinRequestValidation {
  const pickupPointId = input.pickupPointId;
  const idempotencyKey = input.idempotencyKey;

  if (
    typeof pickupPointId !== 'string' ||
    pickupPointId.trim().length === 0 ||
    pickupPointId.length > 100
  ) {
    return {
      ok: false,
      message: 'Choose a valid pickup point.',
    };
  }

  if (!isUuid(idempotencyKey)) {
    return {
      ok: false,
      message: 'A valid idempotency key is required.',
    };
  }

  return {
    ok: true,
    value: {
      pickupPointId: pickupPointId.trim(),
      idempotencyKey,
    },
  };
}
