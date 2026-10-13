/**
 * Rules for SOS alerts (CS455-60: FR-RD-15, FR-RO-13.2): who may raise one, how an incident moves
 * for operations admins, and what the SOS and incident requests may hold. Shared by the SOS APIs,
 * the ride page and the admin incident pages. Pure functions only.
 */
import type { RideState } from './ride-status';
import { isTripActive } from './trip-rules';

/**
 * Anyone with a seat on the ride, rider or owner, may raise an SOS while the trip is under way
 * (FR-RD-15.1, FR-RO-13.2), suspended or not (FR-RD-01.5).
 */
export function canRaiseSos(state: RideState, hasSeat: boolean): boolean {
  return hasSeat && isTripActive(state);
}

export const INCIDENT_STATUSES = ['open', 'acknowledged', 'closed'] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  closed: 'Closed',
};

export const SOS_RULES = {
  /** An admin's closing note, at most this many characters (schema.sql). */
  closeNoteMax: 1000,
  /** How long the browser may take to find the location before the alert goes without it. */
  locationTimeoutMs: 10_000,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** What the person who raised an SOS may add afterwards: where they are, or that it was a false alarm. */
export type SosUpdate =
  | { kind: 'location'; latitude: number; longitude: number; accuracy: number | null }
  | { kind: 'false_alarm' };

export const sosUpdateMessage =
  'Send a location (latitude and longitude) or mark the alert as a false alarm.';

/** The body of PATCH /api/sos/[id]: `{ latitude, longitude, accuracy? }` or `{ falseAlarm: true }`. */
export function parseSosUpdate(
  body: unknown,
): { ok: true; value: SosUpdate } | { ok: false; error: string } {
  const input = isRecord(body) ? body : {};
  if (input.falseAlarm === true) return { ok: true, value: { kind: 'false_alarm' } };
  const { latitude, longitude, accuracy } = input;
  const accuracyOk =
    accuracy === undefined || accuracy === null || isNumberIn(accuracy, 0, Number.MAX_SAFE_INTEGER);
  if (isNumberIn(latitude, -90, 90) && isNumberIn(longitude, -180, 180) && accuracyOk) {
    return {
      ok: true,
      value: {
        kind: 'location',
        latitude,
        longitude,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
      },
    };
  }
  return { ok: false, error: sosUpdateMessage };
}

export type IncidentAction = { action: 'acknowledge' } | { action: 'close'; note: string };

export const incidentActionMessages = {
  action: 'Choose Acknowledge or Close.',
  note: `Say how the incident was handled, in ${SOS_RULES.closeNoteMax} characters or fewer.`,
} as const;

/** The body of PATCH /api/admin/incidents/[id]: `{ action: 'acknowledge' }` or `{ action: 'close', note }`. */
export function parseIncidentAction(
  body: unknown,
):
  | { ok: true; value: IncidentAction }
  | { ok: false; errors: Partial<Record<'action' | 'note', string>> } {
  const input = isRecord(body) ? body : {};
  if (input.action === 'acknowledge') return { ok: true, value: { action: 'acknowledge' } };
  if (input.action !== 'close')
    return { ok: false, errors: { action: incidentActionMessages.action } };
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (!note || Array.from(note).length > SOS_RULES.closeNoteMax) {
    return { ok: false, errors: { note: incidentActionMessages.note } };
  }
  return { ok: true, value: { action: 'close', note } };
}

/** Why someone cannot raise or update an SOS now. */
export type SosRefusal = 'not_active' | 'closed';

export const sosRefusalMessages: Record<SosRefusal, string> = {
  not_active:
    'SOS is available while the trip is under way. If you are in danger, call 112 or campus security now.',
  closed: 'An operations admin has closed this alert, so it cannot change any more.',
};

/** Why an admin cannot take this action on an incident in this status, or null when they can. */
export function incidentActionRefusal(
  status: IncidentStatus,
  action: IncidentAction['action'],
): 'closed' | 'already_acknowledged' | null {
  if (status === 'closed') return 'closed';
  if (action === 'acknowledge' && status === 'acknowledged') return 'already_acknowledged';
  return null;
}
