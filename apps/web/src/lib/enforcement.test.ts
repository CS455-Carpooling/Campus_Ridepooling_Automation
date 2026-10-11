// @vitest-environment node
import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActiveSuspension = vi.hoisted(() => vi.fn());
vi.mock('./suspensions', () => ({ getActiveSuspension }));

import { reactivateRider, suspendRider, warnRider } from './enforcement';

const RIDER = '6f1c2a5e-2222-4000-8000-000000000001';
const ADMIN = '6f1c2a5e-2222-4000-8000-0000000000aa';
const COMPLAINT = 'c0c0c0c0-1111-4000-8000-000000000001';
const now = new Date('2026-10-11T00:00:00Z');

type Query = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

type Answers = { role?: string | null; complaint?: boolean; active?: unknown[] };

function enforcementClient(answers: Answers = {}) {
  const query = vi.fn<Query>(async (sql) => {
    if (sql.includes('SELECT role FROM users')) {
      return { rows: answers.role === null ? [] : [{ role: answers.role ?? 'student' }] };
    }
    if (sql.includes('FROM complaints'))
      return { rows: answers.complaint === false ? [] : [{ '?column?': 1 }] };
    if (sql.includes('INSERT INTO rider_warnings'))
      return { rows: [{ id: 'w-1', issued_at: now }] };
    if (sql.includes('INSERT INTO rider_suspensions')) return { rows: [{ id: 's-1' }] };
    if (sql.includes('FROM rider_suspensions')) return { rows: answers.active ?? [{ id: 's-1' }] };
    return { rows: [] };
  });
  return { client: { query } as unknown as PoolClient, query };
}

const notice = (query: ReturnType<typeof vi.fn>) =>
  query.mock.calls.find(([sql]) =>
    String(sql).includes('INSERT INTO notifications'),
  )?.[1] as string[];

beforeEach(() => {
  getActiveSuspension.mockReset();
  getActiveSuspension.mockResolvedValue(null);
});

describe('warnRider (OA-FR-21)', () => {
  it('records the warning with its reason and tells the rider, without the reason', async () => {
    const { client, query } = enforcementClient();
    const result = await warnRider(
      client,
      RIDER,
      { reason: 'Rude to the owner', complaintId: COMPLAINT },
      ADMIN,
    );
    expect(result).toEqual({
      kind: 'done',
      record: { id: 'w-1', userId: RIDER, issuedAt: now.toISOString() },
    });
    const insert = query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO rider_warnings'),
    );
    expect(insert?.[1]).toEqual([RIDER, COMPLAINT, 'Rude to the owner', ADMIN]);
    expect(notice(query)[1]).toBe('account_warning');
    expect(notice(query).join(' ')).not.toContain('Rude');
  });

  it('refuses an unknown person, an admin, and a complaint about someone else', async () => {
    await expect(
      warnRider(
        enforcementClient({ role: null }).client,
        RIDER,
        { reason: 'x', complaintId: null },
        ADMIN,
      ),
    ).resolves.toEqual({
      kind: 'not_found',
    });
    await expect(
      warnRider(
        enforcementClient({ role: 'admin' }).client,
        RIDER,
        { reason: 'x', complaintId: null },
        ADMIN,
      ),
    ).resolves.toEqual({
      kind: 'not_a_rider',
    });
    await expect(
      warnRider(
        enforcementClient({ complaint: false }).client,
        RIDER,
        { reason: 'x', complaintId: COMPLAINT },
        ADMIN,
      ),
    ).resolves.toEqual({ kind: 'complaint_mismatch' });
  });
});

describe('suspendRider (OA-FR-23, UC-OA-08, SYS-FR-24, 25)', () => {
  const request = {
    reasonCategory: 'safety' as const,
    reason: 'Unsafe driving',
    days: 3,
    indefinite: false,
    complaintId: null,
  };

  it('suspends for a number of days, and tells the rider until when and why, by category', async () => {
    const { client, query } = enforcementClient();
    const result = await suspendRider(client, RIDER, request, ADMIN, now);
    expect(result).toEqual({
      kind: 'done',
      record: {
        id: 's-1',
        userId: RIDER,
        startsAt: now.toISOString(),
        endsAt: '2026-10-14T00:00:00.000Z',
        isIndefinite: false,
      },
    });
    const insert = query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO rider_suspensions'),
    );
    expect(insert?.[1]).toEqual([
      RIDER,
      null,
      'safety',
      'Unsafe driving',
      now,
      new Date('2026-10-14T00:00:00Z'),
      false,
      ADMIN,
    ]);
    expect(notice(query)[3]).toContain('until Wed 14 Oct, 05:30 (IST) (reason: Safety)');
    expect(notice(query).join(' ')).not.toContain('Unsafe driving');
  });

  it('suspends indefinitely, until an admin lifts it (SYS-FR-26)', async () => {
    const { client, query } = enforcementClient();
    const result = await suspendRider(
      client,
      RIDER,
      { ...request, days: null, indefinite: true },
      ADMIN,
      now,
    );
    expect(result).toMatchObject({ kind: 'done', record: { endsAt: null, isIndefinite: true } });
    expect(notice(query)[3]).toContain('until an operations admin lifts it');
  });

  it('refuses a second suspension while one is in force', async () => {
    getActiveSuspension.mockResolvedValue({ id: 's-0', endsAt: '2026-10-12T00:00:00.000Z' });
    const { client, query } = enforcementClient();
    await expect(suspendRider(client, RIDER, request, ADMIN, now)).resolves.toEqual({
      kind: 'already_suspended',
      endsAt: '2026-10-12T00:00:00.000Z',
    });
    expect(getActiveSuspension).toHaveBeenCalledWith(RIDER, now, client);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
  });

  it('refuses an admin and a complaint about someone else', async () => {
    await expect(
      suspendRider(enforcementClient({ role: 'admin' }).client, RIDER, request, ADMIN, now),
    ).resolves.toEqual({
      kind: 'not_a_rider',
    });
    await expect(
      suspendRider(
        enforcementClient({ complaint: false }).client,
        RIDER,
        { ...request, complaintId: COMPLAINT },
        ADMIN,
        now,
      ),
    ).resolves.toEqual({ kind: 'complaint_mismatch' });
  });
});

describe('reactivateRider (OA-FR-28, US-OA-14)', () => {
  it('lifts the suspension in force with the reason, keeping its history', async () => {
    const { client, query } = enforcementClient();
    const result = await reactivateRider(client, RIDER, { reason: 'Appeal accepted' }, ADMIN, now);
    expect(result).toEqual({
      kind: 'done',
      record: { suspensionId: 's-1', userId: RIDER, liftedAt: now.toISOString() },
    });
    const lift = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE rider_suspensions'));
    expect(lift?.[1]).toEqual([['s-1'], now, ADMIN, 'Appeal accepted']);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('DELETE'))).toBe(false);
    expect(notice(query)[1]).toBe('account_reactivated');
  });

  it('refuses a rider who is not suspended, an unknown person and an admin', async () => {
    await expect(
      reactivateRider(enforcementClient({ active: [] }).client, RIDER, { reason: 'x' }, ADMIN, now),
    ).resolves.toEqual({
      kind: 'not_suspended',
    });
    await expect(
      reactivateRider(enforcementClient({ role: null }).client, RIDER, { reason: 'x' }, ADMIN, now),
    ).resolves.toEqual({
      kind: 'not_found',
    });
    await expect(
      reactivateRider(
        enforcementClient({ role: 'admin' }).client,
        RIDER,
        { reason: 'x' },
        ADMIN,
        now,
      ),
    ).resolves.toEqual({
      kind: 'not_a_rider',
    });
  });
});
