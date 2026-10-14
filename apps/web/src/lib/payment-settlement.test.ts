// @vitest-environment node
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { changeSettlement, sendDuePaymentReminders } from './payment-settlement';

const RIDE = '0b9a7c1e-1111-4000-8000-000000000001';
const OWNER = '6f1c2a5e-2222-4000-8000-000000000001';
const RIDER = '6f1c2a5e-2222-4000-8000-000000000002';
const SEAT = '7a2b3c4d-3333-4000-8000-000000000003';
const NOW = new Date('2026-10-14T00:00:00.000Z');

function setup(change: Record<string, unknown> = {}) {
  const query = vi.fn(async (sql: string, values?: unknown[]) => {
    void values;
    if (sql.includes('SELECT ride.owner_id')) {
      return {
        rows: [
          {
            owner_id: OWNER,
            ride_state: 'completed',
            user_id: RIDER,
            no_show_at: null,
            role: 'rider',
            share: 125,
            payment_status: 'due',
            payment_method: null,
            payment_reference: null,
            ...change,
          },
        ],
      };
    }
    if (sql.includes('INSERT INTO complaints')) return { rows: [{ reference: 'CMP-12345678' }] };
    return { rows: [] };
  });
  return { client: { query } as unknown as PoolClient, query };
}

describe('post-ride payment settlement', () => {
  it('lets only the rider mark their own Due share Paid and notifies the owner', async () => {
    const { client, query } = setup();
    const result = await changeSettlement(
      client,
      RIDE,
      SEAT,
      RIDER,
      { type: 'paid', input: { method: 'upi', reference: 'ref-123' } },
      NOW,
    );
    expect(result).toEqual({ kind: 'done', status: 'paid' });
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("SET payment_status = 'paid'")),
    ).toBe(true);
    const notice = query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO notifications'),
    );
    expect(notice?.[1]).toContain(OWNER);
    expect(notice?.[1]).not.toContain('ref-123');
  });

  it('refuses non-owner decisions before exposing settlement state', async () => {
    const { client, query } = setup({ payment_status: 'paid', payment_method: 'cash' });
    const result = await changeSettlement(client, RIDE, SEAT, RIDER, { type: 'confirm' }, NOW);
    expect(result).toEqual({ kind: 'not_owner' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE ride_final_shares'))).toBe(
      false,
    );
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO complaints'))).toBe(
      false,
    );
  });

  it('opens an admin-reviewable Payment complaint and notifies the rider on dispute', async () => {
    const { client, query } = setup({
      payment_status: 'paid',
      payment_method: 'upi',
      payment_reference: 'private-ref',
    });
    const result = await changeSettlement(client, RIDE, SEAT, OWNER, { type: 'dispute' }, NOW);
    expect(result).toEqual({
      kind: 'done',
      status: 'disputed',
      complaintReference: 'CMP-12345678',
    });
    const complaint = query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO complaints'),
    );
    expect(complaint?.[0]).toContain("'payment', $4, 'payment_dispute'");
    const notice = query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO notifications'),
    );
    expect(notice?.[1]).toContain(RIDER);
    expect(notice?.[1]).not.toContain('private-ref');
  });

  it('does not create a payable share for a no-show seat', async () => {
    const { client, query } = setup({
      role: null,
      share: null,
      payment_status: null,
      no_show_at: NOW,
    });
    const result = await changeSettlement(
      client,
      RIDE,
      SEAT,
      RIDER,
      { type: 'paid', input: { method: 'cash', reference: null } },
      NOW,
    );
    expect(result).toEqual({ kind: 'no_payable_share' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE ride_final_shares'))).toBe(
      false,
    );
  });

  it('uses one-time Due-only reminder timestamps and notifications', async () => {
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      void values;
      return sql.includes('SELECT ride.id AS ride_id')
        ? {
            rows: [
              {
                ride_id: RIDE,
                user_id: RIDER,
                completed_at: new Date('2026-10-12T00:00:00Z'),
                reminder: 24,
              },
            ],
          }
        : { rows: [{ user_id: RIDER }] };
    });
    const count = await sendDuePaymentReminders({ query } as unknown as PoolClient, NOW);
    expect(count).toBe(1);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('reminder_24_at'))).toBe(true);
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO notifications')),
    ).toBe(true);
  });

  it('sends the later reminder only after its 72-hour threshold', async () => {
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      void values;
      return sql.includes('SELECT ride.id AS ride_id')
        ? {
            rows: [
              {
                ride_id: RIDE,
                user_id: RIDER,
                completed_at: new Date('2026-10-10T00:00:00Z'),
                reminder: 72,
              },
            ],
          }
        : { rows: [{ user_id: RIDER }] };
    });
    await sendDuePaymentReminders({ query } as unknown as PoolClient, NOW);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('reminder_72_at'))).toBe(true);
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO notifications')),
    ).toBe(true);
  });
});
