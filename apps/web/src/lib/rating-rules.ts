/**
 * Rules for completing a ride and rating the people on it (CS455-39: FR-RO-09.4,
 * FR-RD-12, FR-RO-12): when rating is open, who may mark a ride completed, and
 * what a rating request may hold. Shared by the review page, its form and the
 * APIs, so they always agree. Pure functions only: no database, no React.
 */
import { isUuid } from './ids';
import type { RideState, ViewerRole } from './ride-status';

export const RATING_RULES = {
  /** Rating is open for 72 hours after the owner marks the ride completed (P-16, AC1). */
  windowHours: 72,
  /** Others see a person's average only once it rests on 3 ratings or more (P-24, AC3). */
  minRatingsToShow: 3,
  minScore: 1,
  maxScore: 5,
  commentMaxLength: 500,
  /** A score this low or lower points the rater to the complaint contact (FR-RD-12.4). */
  lowScoreMax: 2,
  /** The most people one request may rate: more than anyone shares a vehicle with. */
  maxPerRequest: 10,
} as const;

const HOUR = 3_600_000;

/** When rating closes for a ride completed at `completedAt`. */
export function ratingClosesAt(completedAt: Date): Date {
  return new Date(completedAt.getTime() + RATING_RULES.windowHours * HOUR);
}

/**
 * Whether the people on a ride can rate each other now. A ride that was never
 * completed, or was cancelled, cannot be rated; a completed one can until its
 * 72 hours are over, and not from the moment they are (AC1).
 */
export type RatingWindow = 'not_completed' | 'cancelled' | 'open' | 'closed';

export function ratingWindow(state: RideState, completedAt: Date | null, now: Date): RatingWindow {
  if (state === 'cancelled') return 'cancelled';
  if (state !== 'completed' || !completedAt) return 'not_completed';
  return now.getTime() < ratingClosesAt(completedAt).getTime() ? 'open' : 'closed';
}

/** Why a ride cannot be marked completed now. */
export type CompleteRideRefusal = 'not_owner' | 'cancelled' | 'already_completed' | 'too_early';

/**
 * Why `role` may not mark this ride completed, or null when they may: only its
 * owner, only once the departure window has started, never a cancelled ride,
 * and only once, because a completed ride cannot be reopened. An owner alone on
 * the ride may complete it too; there is then simply nobody to rate.
 */
export function completeRideRefusal(
  role: ViewerRole,
  state: RideState,
  departureStart: Date,
  now: Date,
): CompleteRideRefusal | null {
  if (role !== 'owner') return 'not_owner';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'completed') return 'already_completed';
  if (now.getTime() < departureStart.getTime()) return 'too_early';
  return null;
}

/**
 * One rating in the body of POST /api/rides/[id]/ratings. `occupantId` names a
 * seat on that ride (riders.id), never an account, so the page never needs to
 * send user IDs to the browser.
 */
export type RatingEntry = {
  occupantId: string;
  score: number;
  /** Trimmed; null when left empty. */
  comment: string | null;
};

export type RatingsRequestResult =
  { ok: true; ratings: RatingEntry[] } | { ok: false; error: string };

export const ratingMessages = {
  list: `Send between 1 and ${RATING_RULES.maxPerRequest} ratings at a time.`,
  person: 'Each rating must name a person on this ride.',
  score: `Give each person you rate a whole-number score from ${RATING_RULES.minScore} to ${RATING_RULES.maxScore}.`,
  comment: `Keep each comment to ${RATING_RULES.commentMaxLength} characters or fewer.`,
  duplicate: 'Rate each person only once.',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// PostgreSQL's char_length counts characters, and so does Array.from: an emoji is one, not two.
function characterCount(text: string): number {
  return Array.from(text).length;
}

/**
 * Checks the body of a ratings request, `{ ratings: [{ occupantId, score,
 * comment? }] }`, and returns the ratings ready to store, or the first problem
 * as a message for the person rating. Rating several people at once, and only
 * some of them, are both allowed; the rest can be rated later while rating is open.
 */
export function parseRatingsRequest(body: unknown): RatingsRequestResult {
  const list = isRecord(body) ? body.ratings : undefined;
  if (!Array.isArray(list) || list.length < 1 || list.length > RATING_RULES.maxPerRequest) {
    return { ok: false, error: ratingMessages.list };
  }

  const ratings: RatingEntry[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    if (!isRecord(entry) || !isUuid(entry.occupantId)) {
      return { ok: false, error: ratingMessages.person };
    }
    const { score, comment } = entry;
    if (
      typeof score !== 'number' ||
      !Number.isInteger(score) ||
      score < RATING_RULES.minScore ||
      score > RATING_RULES.maxScore
    ) {
      return { ok: false, error: ratingMessages.score };
    }
    if (comment !== undefined && comment !== null && typeof comment !== 'string') {
      return { ok: false, error: ratingMessages.comment };
    }
    const text = typeof comment === 'string' ? comment.trim() : '';
    if (characterCount(text) > RATING_RULES.commentMaxLength) {
      return { ok: false, error: ratingMessages.comment };
    }
    const occupantId = entry.occupantId.toLowerCase();
    if (seen.has(occupantId)) return { ok: false, error: ratingMessages.duplicate };
    seen.add(occupantId);
    ratings.push({ occupantId, score, comment: text === '' ? null : text });
  }
  return { ok: true, ratings };
}

/** Whether a score is low enough to point the rater to the complaint contact (FR-RD-12.4). */
export function offersComplaint(score: number): boolean {
  return score >= RATING_RULES.minScore && score <= RATING_RULES.lowScoreMax;
}

/** The five scores, each with the word that the review page reads out for it. */
export const scoreChoices = [
  { score: 1, label: 'Poor' },
  { score: 2, label: 'Fair' },
  { score: 3, label: 'Good' },
  { score: 4, label: 'Very good' },
  { score: 5, label: 'Excellent' },
] as const;

/**
 * What anyone may see about a person's ratings: their average and how many it
 * rests on, only from 3 ratings up (P-24), and never who gave them.
 */
export type PublicRating = { average: number; count: number };

/**
 * What a person sees about their own ratings on their profile. `average` is
 * null below 3 ratings; `comments` are the text alone, without the rater, the
 * score, the ride or the date, and empty below 3 ratings.
 */
export type OwnRating = { count: number; average: number | null; comments: string[] };
