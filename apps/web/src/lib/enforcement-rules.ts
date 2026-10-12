/**
 * Rules for an admin's warnings, suspensions and reactivations (OA-FR-21 to 28, UC-OA-08,
 * CS455-52), shared by the admin pages and APIs. The database enforces the absolute ones again
 * (schema.sql). Pure functions only.
 */
import {
  COMPLAINT_CATEGORIES,
  complaintCategoryLabels,
  type ComplaintCategory,
} from './complaint-rules';
import { formatDeparture } from './format';
import { isUuid } from './ids';
import type { ActiveSuspension } from './suspensions';

export const ENFORCEMENT_RULES = {
  reasonMax: 1000,
  /** A timed suspension lasts 1 day to 10 years; longer than that, choose indefinite. */
  minDays: 1,
  maxDays: 3650,
} as const;

export const enforcementMessages = {
  reason: `Give a reason of up to ${ENFORCEMENT_RULES.reasonMax} characters.`,
  reasonCategory: 'Choose what the suspension is for.',
  length: `Choose a length from ${ENFORCEMENT_RULES.minDays} to ${ENFORCEMENT_RULES.maxDays} days, or indefinite.`,
  complaintId: 'The linked complaint could not be found.',
} as const;

export type EnforcementField = 'reason' | 'reasonCategory' | 'length' | 'complaintId';
export type EnforcementErrors = Partial<Record<EnforcementField, string>>;
export type EnforcementResult<T> =
  { ok: true; value: T } | { ok: false; errors: EnforcementErrors };

export type WarningRequest = { reason: string; complaintId: string | null };

/** A suspension lasts a number of days or is indefinite, never both and never neither. */
export type SuspensionRequest = {
  reasonCategory: ComplaintCategory;
  reason: string;
  days: number | null;
  indefinite: boolean;
  complaintId: string | null;
};

export type ReactivationRequest = { reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function cleanReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  return reason.length >= 1 && Array.from(reason).length <= ENFORCEMENT_RULES.reasonMax
    ? reason
    : null;
}

/** Undefined or null means none; anything else must be a complaint ID. */
function cleanComplaintId(value: unknown): string | null | false {
  if (value === undefined || value === null || value === '') return null;
  return isUuid(value) ? value.toLowerCase() : false;
}

export function parseWarningRequest(body: unknown): EnforcementResult<WarningRequest> {
  const input = isRecord(body) ? body : {};
  const errors: EnforcementErrors = {};
  const reason = cleanReason(input.reason);
  if (!reason) errors.reason = enforcementMessages.reason;
  const complaintId = cleanComplaintId(input.complaintId);
  if (complaintId === false) errors.complaintId = enforcementMessages.complaintId;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { reason: reason as string, complaintId: complaintId as string | null },
  };
}

export function parseSuspensionRequest(body: unknown): EnforcementResult<SuspensionRequest> {
  const input = isRecord(body) ? body : {};
  const errors: EnforcementErrors = {};

  const reasonCategory = (COMPLAINT_CATEGORIES as readonly unknown[]).includes(input.reasonCategory)
    ? (input.reasonCategory as ComplaintCategory)
    : null;
  if (!reasonCategory) errors.reasonCategory = enforcementMessages.reasonCategory;

  const reason = cleanReason(input.reason);
  if (!reason) errors.reason = enforcementMessages.reason;

  const indefinite = input.indefinite === true;
  const days = input.days;
  const timed =
    typeof days === 'number' &&
    Number.isInteger(days) &&
    days >= ENFORCEMENT_RULES.minDays &&
    days <= ENFORCEMENT_RULES.maxDays;
  const noDays = days === undefined || days === null;
  if (indefinite ? !noDays : !timed) errors.length = enforcementMessages.length;

  const complaintId = cleanComplaintId(input.complaintId);
  if (complaintId === false) errors.complaintId = enforcementMessages.complaintId;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      reasonCategory: reasonCategory as ComplaintCategory,
      reason: reason as string,
      days: indefinite ? null : (days as number),
      indefinite,
      complaintId: complaintId as string | null,
    },
  };
}

export function parseReactivationRequest(body: unknown): EnforcementResult<ReactivationRequest> {
  const input = isRecord(body) ? body : {};
  const reason = cleanReason(input.reason);
  if (!reason) return { ok: false, errors: { reason: enforcementMessages.reason } };
  return { ok: true, value: { reason } };
}

/** When a suspension of `days` days that starts at `start` ends. */
export function suspensionEndsAt(start: Date, days: number): Date {
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * What a suspended rider is told when refused (FR-RD-01.5): until when, and the reason
 * category, never the admin's own words. `refused` names what they tried, for example
 * "offer a ride".
 */
export function suspendedMessage(suspension: ActiveSuspension, refused: string): string {
  const until = suspension.endsAt
    ? `until ${formatDeparture(suspension.endsAt)} (IST)`
    : 'until an operations admin lifts it';
  const category = complaintCategoryLabels[suspension.reasonCategory];
  return `Your account is suspended ${until} (reason: ${category}), so you cannot ${refused}. You can still file a complaint.`;
}
