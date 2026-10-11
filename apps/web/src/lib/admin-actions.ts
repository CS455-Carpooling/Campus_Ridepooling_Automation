import 'server-only';
import type { Pool, PoolClient } from 'pg';
import type { AdminSession } from './admin-auth';
import { pool } from './db';
import { isUuid } from './ids';

/** What an admin action is about, for its audit record (SYS-FR-45). */
export type AdminActionMeta = {
  /** For example `vehicle_type.update` or `rider.suspend`. */
  action: string;
  entityType: string;
  /** May be replaced by the result's `entityId`, for an action that creates the entity. */
  entityId: string;
  /** Required by the caller when the action needs one (a warning, a suspension, a lift). */
  reason?: string | null;
};

export type AdminActionSuccess<T> = {
  ok: true;
  value: T;
  entityId?: string;
  /** The entity before and after, for the audit record (SYS-NFR-01). */
  before?: unknown;
  after?: unknown;
};

/** A refusal to send back as `{ error, code, fields? }` with `status`. */
export type AdminActionRefusal = {
  ok: false;
  status: number;
  error: string;
  code: string;
  fields?: Record<string, string>;
};

export type AdminActionResult<T> = AdminActionSuccess<T> | AdminActionRefusal;

export function adminRefusal(
  status: number,
  code: string,
  error: string,
  fields?: Record<string, string>,
): AdminActionRefusal {
  return fields ? { ok: false, status, error, code, fields } : { ok: false, status, error, code };
}

const AUDIT_SQL = `
  INSERT INTO admin_audit_log
    (actor_type, admin_id, action, entity_type, entity_id, reason,
     before_state, after_state, outcome, error_code)
  VALUES ('admin', $1, $2, $3, $4, $5, $6, $7, $8, $9)`;

type Outcome = 'succeeded' | 'refused' | 'failed';

async function audit(
  db: Pool | PoolClient,
  admin: AdminSession,
  meta: AdminActionMeta,
  outcome: Outcome,
  details: { before?: unknown; after?: unknown; errorCode?: string } = {},
): Promise<void> {
  await db.query(AUDIT_SQL, [
    admin.userId,
    meta.action,
    meta.entityType,
    meta.entityId,
    meta.reason ?? null,
    details.before ?? null,
    details.after ?? null,
    outcome,
    details.errorCode ?? null,
  ]);
}

/** Records a refused or failed action outside the rolled-back transaction, never throwing. */
async function auditAfterRollback(
  admin: AdminSession,
  meta: AdminActionMeta,
  outcome: Exclude<Outcome, 'succeeded'>,
  errorCode: string,
): Promise<void> {
  try {
    await audit(pool, admin, meta, outcome, { errorCode });
  } catch (error) {
    console.error(`Could not record the ${outcome} admin action ${meta.action}:`, error);
  }
}

/**
 * Runs one state-changing admin action (CS455-48): in a single transaction, with the admin's
 * role checked again inside it, and an audit record of every attempt (SYS-FR-45, 48;
 * SYS-NFR-01, 03, 06).
 *
 * - `run` does the work on the transaction's client and returns a success or a refusal.
 * - On success the audit record is written in the same transaction, and the result is
 *   returned only after COMMIT, so an action is never reported done before it is saved.
 * - On a refusal, or an error, nothing is kept, and the attempt is audited as refused or
 *   failed. Errors become a 500 refusal; they are logged, not shown.
 *
 * The development test admin has no real account to audit against, so it may look but
 * not change anything.
 */
export async function withAdminAction<T>(
  admin: AdminSession,
  meta: AdminActionMeta,
  run: (client: PoolClient) => Promise<AdminActionResult<T>>,
): Promise<AdminActionResult<T>> {
  if (!isUuid(admin.userId)) {
    return adminRefusal(
      403,
      'real_admin_required',
      'Sign in with a real admin account to change anything (see "Making an operations admin" in setup.md).',
    );
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Checked again here, so an admin whose role was revoked cannot finish an action.
    const { rows } = await client.query<{ role: string }>(
      'SELECT role FROM users WHERE id = $1 FOR SHARE',
      [admin.userId],
    );
    if (rows[0]?.role !== 'admin') {
      await client.query('ROLLBACK');
      const refusal = adminRefusal(403, 'not_admin', 'Operations admins only.');
      await auditAfterRollback(admin, meta, 'refused', refusal.code);
      return refusal;
    }

    const result = await run(client);
    if (!result.ok) {
      await client.query('ROLLBACK');
      await auditAfterRollback(admin, meta, 'refused', result.code);
      return result;
    }

    await audit(
      client,
      admin,
      { ...meta, entityId: result.entityId ?? meta.entityId },
      'succeeded',
      {
        before: result.before,
        after: result.after,
      },
    );
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error(`Admin action ${meta.action} failed:`, error);
    await auditAfterRollback(admin, meta, 'failed', 'server_error');
    return adminRefusal(
      500,
      'server_error',
      'The change could not be saved, so nothing was changed.',
    );
  } finally {
    client?.release();
  }
}
