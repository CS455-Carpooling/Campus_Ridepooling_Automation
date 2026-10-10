/**
 * Rules for a rider's complaint about someone they shared a trip with (FR-RD-13, CS455-46):
 * categories, statuses, the P-17 limits, when a complaint can be filed, and what a request
 * may hold. Shared by the complaint form and the complaints API, so they always agree. The
 * database enforces the absolute ones again (schema.sql). Pure functions only.
 */
import { isUuid } from './ids';
import type { RideState } from './ride-status';

/** The categories of FR-RD-13.1. The admin requirements' "SOS complaint" (SYS-FR-19) is Safety. */
export const COMPLAINT_CATEGORIES = [
  'safety',
  'harassment',
  'tardiness',
  'payment',
  'no_show',
  'other',
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const complaintCategoryLabels: Record<ComplaintCategory, string> = {
  safety: 'Safety',
  harassment: 'Harassment',
  tardiness: 'Tardiness',
  payment: 'Payment',
  no_show: 'No-show',
  other: 'Other',
};

/** The statuses a rider sees (FR-RD-13.5). */
export const COMPLAINT_STATUSES = ['submitted', 'under_review', 'resolved'] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const complaintStatusLabels: Record<ComplaintStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  resolved: 'Resolved',
};

/** Where a complaint came from: the complaint form, or a reported chat message (FR-RD-09.6). */
export type ComplaintSource = 'form' | 'chat_report';

/** P-17. */
export const COMPLAINT_RULES = {
  /** A complaint can be filed until 7 days after the trip is completed. */
  filingDays: 7,
  minDescription: 20,
  maxDescription: 2000,
  /** At most this many complaints per rider in any 24 hours. */
  maxPerDay: 5,
} as const;

const DAY = 24 * 60 * 60 * 1000;

/** When the complaint form closes for a ride completed at `completedAt`. */
export function complaintFormClosesAt(completedAt: Date): Date {
  return new Date(completedAt.getTime() + COMPLAINT_RULES.filingDays * DAY);
}

/**
 * Whether the complaint form is open for a ride (FR-RD-13.1): from completion until 7 days
 * later. Reporting a chat message (FR-RD-09.6) follows the pool chat's own rules instead.
 */
export type ComplaintWindow = 'not_completed' | 'cancelled' | 'open' | 'closed';

export function complaintWindow(
  state: RideState,
  completedAt: Date | null,
  now: Date,
): ComplaintWindow {
  if (state === 'cancelled') return 'cancelled';
  if (state !== 'completed' || !completedAt) return 'not_completed';
  return now.getTime() < complaintFormClosesAt(completedAt).getTime() ? 'open' : 'closed';
}

/**
 * The body of POST /api/rides/[id]/complaints. `occupantId` is the accused person's seat on
 * the ride (riders.id), never an account ID; `messageId` names a reported chat message.
 */
export type ComplaintRequest = {
  occupantId: string;
  category: ComplaintCategory;
  /** Trimmed. */
  description: string;
  messageId: string | null;
};

export type ComplaintField = 'occupantId' | 'category' | 'description' | 'messageId';

export type ComplaintRequestResult =
  | { ok: true; value: ComplaintRequest }
  | { ok: false; errors: Partial<Record<ComplaintField, string>> };

export const complaintMessages = {
  occupantId: 'Choose who the complaint is about.',
  category: 'Choose what the complaint is about.',
  description: `Describe what happened in ${COMPLAINT_RULES.minDescription} to ${COMPLAINT_RULES.maxDescription} characters.`,
  messageId: 'The reported message could not be found.',
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCategory = (value: unknown): value is ComplaintCategory =>
  typeof value === 'string' && (COMPLAINT_CATEGORIES as readonly string[]).includes(value);

/** Characters as PostgreSQL's char_length counts them: an emoji counts once. */
export function characterCount(text: string): number {
  return Array.from(text).length;
}

/** Checks a complaint request and returns it ready to store, or a message per field. */
export function parseComplaintRequest(body: unknown): ComplaintRequestResult {
  const input = isRecord(body) ? body : {};
  const errors: Partial<Record<ComplaintField, string>> = {};

  if (!isUuid(input.occupantId)) errors.occupantId = complaintMessages.occupantId;
  if (!isCategory(input.category)) errors.category = complaintMessages.category;

  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const length = characterCount(description);
  if (length < COMPLAINT_RULES.minDescription || length > COMPLAINT_RULES.maxDescription) {
    errors.description = complaintMessages.description;
  }

  const messageId = input.messageId ?? null;
  if (messageId !== null && !isUuid(messageId)) errors.messageId = complaintMessages.messageId;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      occupantId: (input.occupantId as string).toLowerCase(),
      category: input.category as ComplaintCategory,
      description,
      messageId: typeof messageId === 'string' ? messageId.toLowerCase() : null,
    },
  };
}
