import 'server-only';
import type { PoolClient } from 'pg';
import { complaintCategoryLabels } from './complaint-rules';
import {
  suspensionEndsAt,
  type ReactivationRequest,
  type SuspensionRequest,
  type WarningRequest,
} from './enforcement-rules';
import { formatDeparture } from './format';
import { getActiveSuspension } from './suspensions';
import { withdrawWaitingRequestsForSuspendedRider } from './join-requests';
import type { NotificationType } from './notification-types';

/**
 * An admin's warnings, suspensions and reactivations (OA-FR-21 to 28, SYS-FR-24 to 27,
 * CS455-52), each inside withAdminAction()'s transaction, which audits it. Nothing here is
 * ever deleted: lifting a suspension records who lifted it and why, and the history stays
 * (US-OA-14). The rider gets a notification, with the end time and the reason category of a
 * suspension but never the admin's own words, which may say who complained (FR-RD-13.3).
 */

export type EnforcementWrite<T> =
  | { kind: 'done'; record: T }
  | { kind: 'not_found' }
  | { kind: 'not_a_rider' }
  | { kind: 'complaint_mismatch' }
  | { kind: 'already_suspended'; endsAt: string | null }
  | { kind: 'not_suspended' };

export type WarningRecord = { id: string; userId: string; issuedAt: string };

export type SuspensionRecord = {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string | null;
  isIndefinite: boolean;
};

export type ReactivationRecord = { suspensionId: string; userId: string; liftedAt: string };

/** The rider must exist and be a student: admins are not warned or suspended through the app. */
async function checkRider(
  client: PoolClient,
  userId: string,
): Promise<'ok' | 'not_found' | 'not_a_rider'> {
  const { rows } = await client.query<{ role: string }>(
    'SELECT role FROM users WHERE id = $1 FOR NO KEY UPDATE',
    [userId],
  );
  if (rows.length === 0) return 'not_found';
  return rows[0].role === 'student' ? 'ok' : 'not_a_rider';
}

/** A linked complaint must be one made about this rider. */
async function complaintIsAbout(
  client: PoolClient,
  complaintId: string | null,
  userId: string,
): Promise<boolean> {
  if (!complaintId) return true;
  const { rows } = await client.query(
    'SELECT 1 FROM complaints WHERE id = $1 AND accused_id = $2',
    [complaintId, userId],
  );
  return rows.length > 0;
}

async function notify(
  client: PoolClient,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
) {
  await client.query(
    'INSERT INTO notifications (user_id, type, title, body) VALUES ($1, $2, $3, $4)',
    [userId, type, title, body],
  );
}

export async function warnRider(
  client: PoolClient,
  userId: string,
  request: WarningRequest,
  adminId: string,
): Promise<EnforcementWrite<WarningRecord>> {
  const rider = await checkRider(client, userId);
  if (rider !== 'ok') return { kind: rider };
  if (!(await complaintIsAbout(client, request.complaintId, userId))) {
    return { kind: 'complaint_mismatch' };
  }
  const { rows } = await client.query<{ id: string; issued_at: Date }>(
    `INSERT INTO rider_warnings (user_id, complaint_id, reason, issued_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, issued_at`,
    [userId, request.complaintId, request.reason, adminId],
  );
  await notify(
    client,
    userId,
    'account_warning',
    'You have received a warning',
    'An operations admin has warned you about your conduct on a ride. Repeated problems can lead to a suspension.',
  );
  return {
    kind: 'done',
    record: { id: rows[0].id, userId, issuedAt: rows[0].issued_at.toISOString() },
  };
}

/** One suspension at a time: a rider already suspended must be reactivated first. */
export async function suspendRider(
  client: PoolClient,
  userId: string,
  request: SuspensionRequest,
  adminId: string,
  now: Date,
): Promise<EnforcementWrite<SuspensionRecord>> {
  const rider = await checkRider(client, userId);
  if (rider !== 'ok') return { kind: rider };
  if (!(await complaintIsAbout(client, request.complaintId, userId))) {
    return { kind: 'complaint_mismatch' };
  }
  const active = await getActiveSuspension(userId, now, client);
  if (active) return { kind: 'already_suspended', endsAt: active.endsAt };

  const endsAt = request.days === null ? null : suspensionEndsAt(now, request.days);
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO rider_suspensions
       (user_id, complaint_id, reason_category, reason, starts_at, ends_at, is_indefinite, issued_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      userId,
      request.complaintId,
      request.reasonCategory,
      request.reason,
      now,
      endsAt,
      request.indefinite,
      adminId,
    ],
  );
  const until = endsAt
    ? `until ${formatDeparture(endsAt.toISOString())} (IST)`
    : 'until an operations admin lifts it';
  await notify(
    client,
    userId,
    'account_suspended',
    'Your account is suspended',
    `Your account is suspended ${until} (reason: ${complaintCategoryLabels[request.reasonCategory]}). You cannot offer rides or rate others until then. You can still file a complaint and see your rides.`,
  );
  await withdrawWaitingRequestsForSuspendedRider(client, userId, now);
  return {
    kind: 'done',
    record: {
      id: rows[0].id,
      userId,
      startsAt: now.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      isIndefinite: request.indefinite,
    },
  };
}

/** Lifts the suspension in force (SYS-FR-26, US-OA-14); the reason is required and kept. */
export async function reactivateRider(
  client: PoolClient,
  userId: string,
  request: ReactivationRequest,
  adminId: string,
  now: Date,
): Promise<EnforcementWrite<ReactivationRecord>> {
  const rider = await checkRider(client, userId);
  if (rider !== 'ok') return { kind: rider };
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM rider_suspensions
     WHERE user_id = $1 AND lifted_at IS NULL AND starts_at <= $2
       AND (ends_at IS NULL OR ends_at > $2)
     FOR UPDATE`,
    [userId, now],
  );
  if (rows.length === 0) return { kind: 'not_suspended' };
  await client.query(
    `UPDATE rider_suspensions SET lifted_at = $2, lifted_by = $3, lift_reason = $4
     WHERE id = ANY($1::uuid[])`,
    [rows.map((row) => row.id), now, adminId, request.reason],
  );
  await notify(
    client,
    userId,
    'account_reactivated',
    'Your account is active again',
    'An operations admin has lifted your suspension. You can offer and join rides again.',
  );
  return {
    kind: 'done',
    record: { suspensionId: rows[0].id, userId, liftedAt: now.toISOString() },
  };
}
