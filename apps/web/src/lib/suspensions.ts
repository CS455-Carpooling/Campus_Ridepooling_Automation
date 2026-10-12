import 'server-only';
import type { Pool, PoolClient } from 'pg';
import type { ComplaintCategory } from './complaint-rules';
import { pool } from './db';
import { isUuid } from './ids';

/**
 * A suspension in force, as the suspended rider may see it: the reason category and when it
 * ends, never the admin's reason text (FR-RD-01.5).
 */
export type ActiveSuspension = {
  id: string;
  reasonCategory: ComplaintCategory;
  startsAt: string;
  /** Null for an indefinite suspension, which lasts until an admin lifts it (SYS-FR-26). */
  endsAt: string | null;
  isIndefinite: boolean;
};

type SuspensionRow = {
  id: string;
  reason_category: ComplaintCategory;
  starts_at: Date;
  ends_at: Date | null;
  is_indefinite: boolean;
};

// The same rule as the active_rider_suspensions view, at the time given: a temporary
// suspension stops at its end time with no job running (SYS-FR-25).
const ACTIVE_SQL = `
  SELECT id, reason_category, starts_at, ends_at, is_indefinite
  FROM rider_suspensions
  WHERE user_id = $1 AND lifted_at IS NULL AND starts_at <= $2
    AND (ends_at IS NULL OR ends_at > $2)
  ORDER BY is_indefinite DESC, ends_at DESC NULLS FIRST
  LIMIT 1`;

/**
 * The suspension in force for `userId` at `now`, or null. When several overlap, the one that
 * lasts longest. Use it wherever a suspended rider must be refused (FR-RD-01.5, SYS-FR-24):
 * pass a transaction's client to check inside it. A user ID that is not a UUID (the
 * development user) is never suspended.
 */
export async function getActiveSuspension(
  userId: string,
  now: Date = new Date(),
  db: Pool | PoolClient = pool,
): Promise<ActiveSuspension | null> {
  if (!isUuid(userId)) return null;
  const { rows } = await db.query<SuspensionRow>(ACTIVE_SQL, [userId, now]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    reasonCategory: row.reason_category,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at ? row.ends_at.toISOString() : null,
    isIndefinite: row.is_indefinite,
  };
}
