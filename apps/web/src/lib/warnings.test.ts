// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ pool: { query } }));

import { hasPendingRiderWarnings, listPendingRiderWarnings } from './warnings';

const RIDER = '6f1c2a5e-2222-4000-8000-000000000001';

beforeEach(() => query.mockReset());

describe('rider warning acknowledgements', () => {
  it('does not query for development-only IDs', async () => {
    await expect(hasPendingRiderWarnings('dev-student')).resolves.toBe(false);
    await expect(listPendingRiderWarnings('dev-student')).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('checks only unacknowledged warnings', async () => {
    query.mockResolvedValueOnce({ rows: [{ pending: true }] });
    await expect(hasPendingRiderWarnings(RIDER)).resolves.toBe(true);
    expect(query.mock.calls[0][0]).toContain('acknowledged_at IS NULL');
    expect(query.mock.calls[0][1]).toEqual([RIDER]);
  });

  it('lists warning category and date without exposing the admin reason', async () => {
    const issuedAt = new Date('2026-10-13T12:00:00Z');
    query.mockResolvedValueOnce({
      rows: [
        { id: 'warning-1', reason_category: 'safety', issued_at: issuedAt, reason: 'private' },
      ],
    });
    await expect(listPendingRiderWarnings(RIDER)).resolves.toEqual([
      { id: 'warning-1', reasonCategory: 'safety', issuedAt: issuedAt.toISOString() },
    ]);
    expect(query.mock.calls[0][0]).toContain('complaint.category AS reason_category');
    expect(query.mock.calls[0][0]).not.toContain('warning.reason');
  });

  it('uses Other when the warning has no linked complaint', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'warning-2', reason_category: null, issued_at: new Date('2026-10-13Z') }],
    });
    await expect(listPendingRiderWarnings(RIDER)).resolves.toMatchObject([
      { reasonCategory: 'other' },
    ]);
  });
});
