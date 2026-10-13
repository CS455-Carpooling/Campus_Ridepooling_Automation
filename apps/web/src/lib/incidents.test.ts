// @vitest-environment node
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { changeIncident } from './incidents';

const ID = 'a5a5a5a5-5555-4000-8000-000000000001';
const ADMIN = '6f1c2a5e-0000-4000-8000-0000000000aa';
const now = new Date('2026-10-13T12:45:00.000Z');

type Query = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

function client(row: Record<string, unknown> | null) {
  const query = vi.fn<Query>(async (sql, params) => {
    if (sql.includes('FOR UPDATE')) return { rows: row ? [row] : [] };
    return {
      rows: [
        sql.includes("status = 'acknowledged'")
          ? { ...row, status: 'acknowledged', acknowledged_at: params?.[1] }
          : { ...row, status: 'closed', closed_at: params?.[1] },
      ],
    };
  });
  return { client: { query } as unknown as PoolClient, query };
}

const open = {
  id: ID,
  reference: 'SOS-1A2B3C4D',
  status: 'open',
  acknowledged_at: null,
  closed_at: null,
};

describe('changeIncident (CS455-65)', () => {
  it('acknowledges an open alert, with before and after for the audit', async () => {
    const { client: c, query } = client(open);
    await expect(changeIncident(c, ID, { action: 'acknowledge' }, ADMIN, now)).resolves.toEqual({
      kind: 'changed',
      before: {
        id: ID,
        reference: 'SOS-1A2B3C4D',
        status: 'open',
        acknowledgedAt: null,
        closedAt: null,
      },
      after: {
        id: ID,
        reference: 'SOS-1A2B3C4D',
        status: 'acknowledged',
        acknowledgedAt: now.toISOString(),
        closedAt: null,
      },
    });
    expect(query.mock.calls[1][1]).toEqual([ID, now, ADMIN]);
  });

  it('closes an alert with the note', async () => {
    const { client: c, query } = client({ ...open, status: 'acknowledged', acknowledged_at: now });
    await expect(
      changeIncident(c, ID, { action: 'close', note: 'Called the rider; all fine.' }, ADMIN, now),
    ).resolves.toMatchObject({
      kind: 'changed',
      after: { status: 'closed', closedAt: now.toISOString() },
    });
    expect(query.mock.calls[1][1]).toEqual([ID, now, ADMIN, 'Called the rider; all fine.']);
  });

  it('refuses a closed alert and a second acknowledgement, and finds no unknown one', async () => {
    await expect(
      changeIncident(
        client({ ...open, status: 'closed', closed_at: now }).client,
        ID,
        { action: 'acknowledge' },
        ADMIN,
        now,
      ),
    ).resolves.toMatchObject({ kind: 'refused', code: 'closed', current: { status: 'closed' } });
    const acknowledged = client({ ...open, status: 'acknowledged', acknowledged_at: now });
    await expect(
      changeIncident(acknowledged.client, ID, { action: 'acknowledge' }, ADMIN, now),
    ).resolves.toMatchObject({ kind: 'refused', code: 'already_acknowledged' });
    expect(acknowledged.query).toHaveBeenCalledTimes(1);
    await expect(
      changeIncident(client(null).client, ID, { action: 'acknowledge' }, ADMIN, now),
    ).resolves.toEqual({
      kind: 'not_found',
    });
  });
});
