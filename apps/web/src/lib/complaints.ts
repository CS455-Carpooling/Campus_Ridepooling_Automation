import 'server-only';
import type { PoolClient } from 'pg';
import {
  canMoveComplaint,
  COMPLAINT_RULES,
  complaintStatusLabels,
  complaintWindow,
  type ComplaintRequest,
  type ComplaintStatus,
  type ComplaintWindow,
} from './complaint-rules';
import type { ComplaintStatusChange } from './admin-types';
import type { RideState } from './ride-status';

/**
 * The complaint writes (FR-RD-13, SYS-FR-19, 31, 47, CS455-52): a rider filing one, and an
 * admin moving one along. The complaint itself, its text, category and people, is never
 * changed afterwards (a trigger in schema.sql refuses it too).
 */

export type FileComplaintResult =
  | { kind: 'filed'; id: string; reference: string }
  | { kind: 'not_found' }
  | { kind: 'not_on_ride' }
  | { kind: 'self' }
  | { kind: 'message_not_found' }
  | { kind: 'window'; window: Exclude<ComplaintWindow, 'open'> }
  | { kind: 'already_filed'; reference: string }
  | { kind: 'daily_limit' };

type RideRow = { state: RideState; completed_at: Date | null; no_show_at: Date | null };

/**
 * Files `request` for `userId` about someone on ride `rideId` (FR-RD-13.1 to 13.4). Only the
 * people on a ride can see it (the ride is "not found" to anyone else), the accused is named
 * by their seat, and a complaint is filed within 7 days of the trip's completion, or, about a
 * reported chat message, whenever that message is still in the ride's chat (FR-RD-09.6).
 * The complainant's row is locked first, so two complaints sent at once count against the
 * daily limit one after the other.
 */
export async function fileComplaint(
  client: PoolClient,
  rideId: string,
  userId: string,
  request: ComplaintRequest,
  now: Date,
): Promise<FileComplaintResult> {
  await client.query('SELECT 1 FROM users WHERE id = $1 FOR NO KEY UPDATE', [userId]);

  const ride = await client.query<RideRow>(
    `SELECT r.state, r.completed_at, me.no_show_at
     FROM rides r
     JOIN riders me ON me.ride_id = r.id AND me.user_id = $2
     WHERE r.id = $1`,
    [rideId, userId],
  );
  if (ride.rows.length === 0) return { kind: 'not_found' };

  const accused = await client.query<{ user_id: string }>(
    'SELECT user_id FROM riders WHERE id = $1 AND ride_id = $2',
    [request.occupantId, rideId],
  );
  if (accused.rows.length === 0) return { kind: 'not_on_ride' };
  const accusedId = accused.rows[0].user_id;
  if (accusedId === userId) return { kind: 'self' };

  if (request.messageId) {
    // The message must be in this ride's chat, sent by the person complained about.
    const message = await client.query(
      `SELECT 1 FROM ride_chat_messages m
       JOIN ride_chats c ON c.id = m.chat_id
       WHERE m.id = $1 AND c.ride_id = $2 AND m.sender_id = $3`,
      [request.messageId, rideId, accusedId],
    );
    if (message.rows.length === 0) return { kind: 'message_not_found' };
  } else {
    const { state, completed_at, no_show_at } = ride.rows[0];
    const window = complaintWindow(state, completed_at, now, no_show_at);
    if (window !== 'open') return { kind: 'window', window };
  }

  const existing = await client.query<{ reference: string }>(
    `SELECT reference FROM complaints
     WHERE complainant_id = $1 AND ride_id = $2 AND accused_id = $3`,
    [userId, rideId, accusedId],
  );
  if (existing.rows.length > 0) {
    return { kind: 'already_filed', reference: existing.rows[0].reference };
  }

  const today = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM complaints
     WHERE complainant_id = $1 AND created_at > $2::timestamptz - interval '24 hours'`,
    [userId, now],
  );
  if ((today.rows[0]?.count ?? 0) >= COMPLAINT_RULES.maxPerDay) return { kind: 'daily_limit' };

  const created = await client.query<{ id: string; reference: string }>(
    `INSERT INTO complaints (ride_id, complainant_id, accused_id, category, description, source)
     VALUES ($1, $2, $3, $4, $5, 'form')
     RETURNING id, reference`,
    [rideId, userId, accusedId, request.category, request.description],
  );
  const complaint = created.rows[0];
  if (request.messageId) {
    await client.query(
      `INSERT INTO complaint_chat_messages (complaint_id, message_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [complaint.id, request.messageId],
    );
  }
  return { kind: 'filed', id: complaint.id, reference: complaint.reference };
}

/** A complaint's status as an admin sees it, with the version to send back when changing it. */
export type ComplaintState = {
  id: string;
  reference: string;
  status: ComplaintStatus;
  actionTaken: boolean | null;
  note: string | null;
  version: number;
};

export type ChangeComplaintResult =
  | { kind: 'changed'; before: ComplaintState; after: ComplaintState }
  | { kind: 'not_found' }
  | { kind: 'version_conflict'; current: ComplaintState }
  | { kind: 'not_allowed'; current: ComplaintState };

type ComplaintStateRow = {
  id: string;
  reference: string;
  status: ComplaintStatus;
  action_taken: boolean | null;
  resolution_note: string | null;
  version: number;
  complainant_id: string;
  ride_id: string;
};

const STATE_COLUMNS =
  'id, reference, status, action_taken, resolution_note, version, complainant_id, ride_id';

const complaintState = (row: ComplaintStateRow): ComplaintState => ({
  id: row.id,
  reference: row.reference,
  status: row.status,
  actionTaken: row.action_taken,
  note: row.resolution_note,
  version: row.version,
});

/**
 * Moves a complaint to Under review or Resolved (OA-FR-18, FR-RD-13.5), for an admin, inside
 * withAdminAction()'s transaction. Resolving records whether action was taken. The person who
 * complained is told the new status, and on resolving only whether action was taken, never
 * the sanction (FR-RD-13.5). Resolving also closes the chat reports it came from, so the pool
 * chat's retention no longer keeps those messages for review.
 */
export async function changeComplaintStatus(
  client: PoolClient,
  complaintId: string,
  change: ComplaintStatusChange,
  adminId: string,
  now: Date,
): Promise<ChangeComplaintResult> {
  const { rows } = await client.query<ComplaintStateRow>(
    `SELECT ${STATE_COLUMNS} FROM complaints WHERE id = $1 FOR UPDATE`,
    [complaintId],
  );
  if (rows.length === 0) return { kind: 'not_found' };
  const before = complaintState(rows[0]);
  if (before.version !== change.version) return { kind: 'version_conflict', current: before };
  if (!canMoveComplaint(before.status, change.status))
    return { kind: 'not_allowed', current: before };

  const resolving = change.status === 'resolved';
  const { rows: saved } = await client.query<ComplaintStateRow>(
    `UPDATE complaints
     SET status = $2,
         action_taken = CASE WHEN $3 THEN $4 ELSE action_taken END,
         resolution_note = COALESCE($5, resolution_note),
         resolved_at = CASE WHEN $3 THEN $6::timestamptz ELSE resolved_at END,
         resolved_by = CASE WHEN $3 THEN $7::uuid ELSE resolved_by END,
         version = version + 1, updated_at = $6::timestamptz
     WHERE id = $1
     RETURNING ${STATE_COLUMNS}`,
    [
      complaintId,
      change.status,
      resolving,
      change.actionTaken ?? null,
      change.note ?? null,
      now,
      adminId,
    ],
  );
  const after = complaintState(saved[0]);
  const { complainant_id: complainantId, ride_id: rideId } = saved[0];

  if (resolving) {
    await client.query(
      `UPDATE ride_chat_complaints SET status = 'resolved', resolved_at = $3
       WHERE status = 'open' AND reporter_id = $2
         AND message_id IN (SELECT message_id FROM complaint_chat_messages WHERE complaint_id = $1)`,
      [complaintId, complainantId, now],
    );
  }

  const outcome = resolving
    ? after.actionTaken
      ? ' Action was taken.'
      : ' No action was taken.'
    : '';
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, related_ride_id)
     VALUES ($1, 'complaint_update', $2, $3, $4)`,
    [
      complainantId,
      `Complaint ${after.reference}: ${complaintStatusLabels[after.status]}`,
      `Your complaint ${after.reference} is now ${complaintStatusLabels[after.status].toLowerCase()}.${outcome}`,
      rideId,
    ],
  );
  return { kind: 'changed', before, after };
}
