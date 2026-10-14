import 'server-only';
import { pool } from './db';
import { isUuid } from './ids';
import type { ComplaintCategory } from './complaint-rules';

export type PendingRiderWarning = {
  id: string;
  reasonCategory: ComplaintCategory;
  issuedAt: string;
};

export async function hasPendingRiderWarnings(userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const { rows } = await pool.query<{ pending: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM rider_warnings
       WHERE user_id = $1 AND acknowledged_at IS NULL
     ) AS pending`,
    [userId],
  );
  return rows[0]?.pending === true;
}

export async function listPendingRiderWarnings(userId: string): Promise<PendingRiderWarning[]> {
  if (!isUuid(userId)) return [];
  const { rows } = await pool.query<{
    id: string;
    reason_category: ComplaintCategory | null;
    issued_at: Date;
  }>(
    `SELECT warning.id, complaint.category AS reason_category, warning.issued_at
     FROM rider_warnings warning
     LEFT JOIN complaints complaint ON complaint.id = warning.complaint_id
     WHERE warning.user_id = $1 AND warning.acknowledged_at IS NULL
     ORDER BY warning.issued_at, warning.id`,
    [userId],
  );
  return rows.map((warning) => ({
    id: warning.id,
    reasonCategory: warning.reason_category ?? 'other',
    issuedAt: warning.issued_at.toISOString(),
  }));
}
