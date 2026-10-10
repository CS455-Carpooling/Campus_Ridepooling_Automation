import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import { getActiveSuspension } from './suspensions';

const USER_ID = '6f1c2a5e-2222-4000-8000-000000000002';
const now = new Date('2026-10-11T12:00:00+05:30');

beforeEach(() => query.mockReset());

describe('getActiveSuspension (FR-RD-01.5, SYS-FR-24 to 26)', () => {
  it('is never asked about a user ID that is not a UUID', async () => {
    await expect(getActiveSuspension('dev-student', now)).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('has nothing for a rider without a suspension in force', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(getActiveSuspension(USER_ID, now)).resolves.toBeNull();
    expect(query.mock.calls[0][1]).toEqual([USER_ID, now]);
  });

  it('gives the category and end of a temporary suspension, never the reason text', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 's1',
          reason_category: 'harassment',
          starts_at: new Date('2026-10-01T00:00:00Z'),
          ends_at: new Date('2027-01-01T00:00:00Z'),
          is_indefinite: false,
          reason: 'never shown',
        },
      ],
    });
    const suspension = await getActiveSuspension(USER_ID, now);
    expect(suspension).toEqual({
      id: 's1',
      reasonCategory: 'harassment',
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2027-01-01T00:00:00.000Z',
      isIndefinite: false,
    });
    expect(JSON.stringify(suspension)).not.toContain('never shown');
  });

  it('SYS-FR-25: counts only suspensions not lifted and not yet ended at the time given', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 's2',
          reason_category: 'safety',
          starts_at: new Date('2026-10-01T00:00:00Z'),
          ends_at: null,
          is_indefinite: true,
        },
      ],
    });
    await expect(getActiveSuspension(USER_ID, now)).resolves.toMatchObject({
      endsAt: null,
      isIndefinite: true,
    });
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('lifted_at IS NULL');
    expect(sql).toContain('ends_at IS NULL OR ends_at > $2');
    expect(sql).not.toContain('reason,');
  });

  it('checks inside a transaction when given its client', async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const client = { query: clientQuery } as unknown as PoolClient;
    await getActiveSuspension(USER_ID, now, client);
    expect(clientQuery).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  });
});
