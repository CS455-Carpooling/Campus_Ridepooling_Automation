import type { PoolClient } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from './admin-auth';

const h = vi.hoisted(() => {
  const clientQuery = vi.fn();
  const release = vi.fn();
  return {
    clientQuery,
    release,
    poolQuery: vi.fn(),
    connect: vi.fn(async () => ({ query: clientQuery, release })),
  };
});
vi.mock('./db', () => ({ pool: { query: h.poolQuery, connect: h.connect } }));

import { adminRefusal, withAdminAction, type AdminActionMeta } from './admin-actions';

const ADMIN_ID = '6f1c2a5e-0000-4000-8000-000000000001';
const admin: AdminSession = {
  userId: ADMIN_ID,
  email: 'ops@iitk.ac.in',
  displayName: 'Ops Admin',
  role: 'admin',
};
const meta: AdminActionMeta = {
  action: 'vehicle_type.update',
  entityType: 'vehicle_type',
  entityId: 'auto',
};

/** The SQL the transaction's client ran, in order, shortened to its first word or two. */
function clientSteps(): string[] {
  return h.clientQuery.mock.calls.map(([sql]) => {
    const text = String(sql).trim();
    if (text.startsWith('INSERT INTO admin_audit_log')) return 'AUDIT';
    if (text.startsWith('SELECT role')) return 'ROLE';
    return text.split(/\s+/)[0];
  });
}

const auditParams = (call: unknown[]) => call[1] as unknown[];

beforeEach(() => {
  h.clientQuery.mockImplementation(async (sql: string) =>
    String(sql).startsWith('SELECT role') ? { rows: [{ role: 'admin' }] } : { rows: [] },
  );
  h.poolQuery.mockResolvedValue({ rows: [] });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('withAdminAction on success (SYS-FR-45, 48)', () => {
  it('does the work, audits it in the same transaction, and commits before answering', async () => {
    const run = vi.fn(async (client: PoolClient) => {
      await client.query('UPDATE vehicle_types SET capacity = 4');
      return { ok: true as const, value: 'saved', before: { capacity: 3 }, after: { capacity: 4 } };
    });

    const result = await withAdminAction(admin, { ...meta, reason: 'Fix' }, run);

    expect(result).toMatchObject({ ok: true, value: 'saved' });
    expect(clientSteps()).toEqual(['BEGIN', 'ROLE', 'UPDATE', 'AUDIT', 'COMMIT']);
    const audit = h.clientQuery.mock.calls.find(([sql]) => String(sql).includes('admin_audit_log'));
    expect(auditParams(audit!)).toEqual([
      ADMIN_ID,
      'vehicle_type.update',
      'vehicle_type',
      'auto',
      'Fix',
      { capacity: 3 },
      { capacity: 4 },
      'succeeded',
      null,
    ]);
    expect(h.poolQuery).not.toHaveBeenCalled();
    expect(h.release).toHaveBeenCalledOnce();
  });

  it('audits a created entity under the ID the work returns', async () => {
    await withAdminAction(
      admin,
      { ...meta, action: 'vehicle_type.create', entityId: 'new' },
      async () => ({
        ok: true,
        value: null,
        entityId: 'e-rickshaw',
      }),
    );
    const audit = h.clientQuery.mock.calls.find(([sql]) => String(sql).includes('admin_audit_log'));
    expect(auditParams(audit!)[3]).toBe('e-rickshaw');
    expect(auditParams(audit!).slice(4, 7)).toEqual([null, null, null]);
  });

  it('checks the role again inside the transaction, holding it until the end', async () => {
    await withAdminAction(admin, meta, async () => ({ ok: true, value: null }));
    expect(h.clientQuery).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1 FOR SHARE', [
      ADMIN_ID,
    ]);
  });
});

describe('withAdminAction when the work refuses (SYS-NFR-06)', () => {
  it('keeps nothing and audits the refusal outside the rolled-back transaction', async () => {
    const result = await withAdminAction(admin, meta, async () =>
      adminRefusal(409, 'version_conflict', 'Someone else changed this.'),
    );

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'version_conflict',
      error: 'Someone else changed this.',
    });
    expect(clientSteps()).toEqual(['BEGIN', 'ROLE', 'ROLLBACK']);
    expect(h.poolQuery).toHaveBeenCalledOnce();
    expect(auditParams(h.poolQuery.mock.calls[0]).slice(7)).toEqual([
      'refused',
      'version_conflict',
    ]);
  });

  it('passes the field messages through', () => {
    expect(adminRefusal(400, 'invalid', 'Check the form.', { name: 'Enter a name.' })).toEqual({
      ok: false,
      status: 400,
      code: 'invalid',
      error: 'Check the form.',
      fields: { name: 'Enter a name.' },
    });
  });
});

describe('withAdminAction for someone who is no longer an admin (SYS-NFR-03)', () => {
  it.each([
    ['whose role was revoked', [{ role: 'student' }]],
    ['whose account is gone', []],
  ])('refuses an admin %s without running the work, and audits it', async (_, rows) => {
    h.clientQuery.mockImplementation(async (sql: string) =>
      String(sql).startsWith('SELECT role') ? { rows } : { rows: [] },
    );
    const run = vi.fn();

    const result = await withAdminAction(admin, meta, run);

    expect(result).toMatchObject({ ok: false, status: 403, code: 'not_admin' });
    expect(run).not.toHaveBeenCalled();
    expect(clientSteps()).toEqual(['BEGIN', 'ROLE', 'ROLLBACK']);
    expect(auditParams(h.poolQuery.mock.calls[0]).slice(7)).toEqual(['refused', 'not_admin']);
  });

  it('refuses the development test admin before touching the database', async () => {
    const result = await withAdminAction({ ...admin, userId: 'dev-admin' }, meta, vi.fn());
    expect(result).toMatchObject({ ok: false, status: 403, code: 'real_admin_required' });
    expect(h.connect).not.toHaveBeenCalled();
    expect(h.poolQuery).not.toHaveBeenCalled();
  });
});

describe('withAdminAction when something fails', () => {
  it('rolls everything back, audits the failure, and never shows the error', async () => {
    const result = await withAdminAction(admin, meta, async (client) => {
      await client.query('UPDATE vehicle_types SET capacity = 4');
      throw new Error('connection reset');
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'server_error',
      error: 'The change could not be saved, so nothing was changed.',
    });
    expect(clientSteps()).toEqual(['BEGIN', 'ROLE', 'UPDATE', 'ROLLBACK']);
    expect(auditParams(h.poolQuery.mock.calls[0]).slice(7)).toEqual(['failed', 'server_error']);
    expect(h.release).toHaveBeenCalledOnce();
  });

  it('does not report success when the commit fails', async () => {
    h.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'COMMIT') throw new Error('serialization failure');
      return String(sql).startsWith('SELECT role') ? { rows: [{ role: 'admin' }] } : { rows: [] };
    });
    const result = await withAdminAction(admin, meta, async () => ({ ok: true, value: 'saved' }));
    expect(result).toMatchObject({ ok: false, code: 'server_error' });
    expect(clientSteps()).toEqual(['BEGIN', 'ROLE', 'AUDIT', 'COMMIT', 'ROLLBACK']);
  });

  it('still answers when the database cannot be reached at all', async () => {
    h.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    h.poolQuery.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await withAdminAction(admin, meta, vi.fn());
    expect(result).toMatchObject({ ok: false, status: 500, code: 'server_error' });
    expect(h.release).not.toHaveBeenCalled();
  });

  it('still answers when the rollback itself fails', async () => {
    h.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'ROLLBACK') throw new Error('connection lost');
      if (String(sql).startsWith('SELECT role')) return { rows: [{ role: 'admin' }] };
      return { rows: [] };
    });
    const result = await withAdminAction(admin, meta, async () => {
      throw new Error('boom');
    });
    expect(result).toMatchObject({ ok: false, code: 'server_error' });
    expect(h.release).toHaveBeenCalledOnce();
  });
});
