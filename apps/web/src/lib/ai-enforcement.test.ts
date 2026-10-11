// @vitest-environment node
import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ warnRider: vi.fn(), suspendRider: vi.fn() }));
vi.mock('./enforcement', () => ({
  warnRider: h.warnRider,
  suspendRider: h.suspendRider,
}));

import { decideComplaintAi } from './ai-enforcement';

const COMPLAINT = 'c0c0c0c0-1111-4000-8000-000000000001';
const ANALYSIS = 'd0d0d0d0-1111-4000-8000-000000000001';
const RIDER = '6f1c2a5e-2222-4000-8000-000000000001';
const ADMIN = '6f1c2a5e-0000-4000-8000-0000000000aa';
const now = new Date('2026-10-11T00:00:00Z');

function client(answer: Record<string, unknown> = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('FROM complaint_ai_analyses a')) {
      return {
        rows: [
          {
            id: ANALYSIS,
            outcome: 'ai_validated',
            recommended_action: 'warning',
            recommended_suspension_days: null,
            recommended_indefinite: false,
            complaint_id: COMPLAINT,
            accused_id: RIDER,
            category: 'safety',
            ...answer,
          },
        ],
      };
    }
    if (sql.includes('SELECT 1 FROM ai_enforcement_decisions')) {
      return { rows: answer.decision_id ? [{ '?column?': 1 }] : [] };
    }
    if (sql.includes('INSERT INTO ai_enforcement_decisions')) {
      return { rows: [{ id: 'e0e0e0e0-1111-4000-8000-000000000001', decided_at: now }] };
    }
    return { rows: [] };
  });
  return { client: { query } as unknown as PoolClient, query };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.warnRider.mockResolvedValue({
    kind: 'done',
    record: { id: 'w0w0w0w0-1111-4000-8000-000000000001' },
  });
  h.suspendRider.mockResolvedValue({
    kind: 'done',
    record: { id: 's0s0s0s0-1111-4000-8000-000000000001' },
  });
});

describe('decideComplaintAi (OA-FR-34, 36; SYS-FR-35, 37, 38)', () => {
  it('records a rejection without calling the enforcement service', async () => {
    const { client: db, query } = client();
    const result = await decideComplaintAi(
      db,
      COMPLAINT,
      ANALYSIS,
      {
        decision: 'rejected',
        finalAction: 'none',
        reason: 'The report does not support a warning.',
        days: null,
        indefinite: false,
      },
      ADMIN,
      now,
    );
    expect(result).toMatchObject({
      kind: 'done',
      record: { decision: 'rejected', finalAction: 'none' },
    });
    expect(h.warnRider).not.toHaveBeenCalled();
    expect(h.suspendRider).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_enforcement_decisions'),
      ),
    ).toBe(true);
  });

  it('executes an explicitly approved warning with the complaint link and same transaction client', async () => {
    const { client: db } = client();
    const result = await decideComplaintAi(
      db,
      COMPLAINT,
      ANALYSIS,
      {
        decision: 'approved',
        finalAction: 'warning',
        reason: 'Admin reviewed and approved this warning.',
        days: null,
        indefinite: false,
      },
      ADMIN,
      now,
    );
    expect(result).toMatchObject({
      kind: 'done',
      record: { decision: 'approved', finalAction: 'warning', warningId: expect.any(String) },
    });
    expect(h.warnRider).toHaveBeenCalledWith(
      db,
      RIDER,
      { reason: 'Admin reviewed and approved this warning.', complaintId: COMPLAINT },
      ADMIN,
    );
  });

  it('requires approval to exactly match the recommendation and refuses duplicate decisions', async () => {
    const { client: db } = client();
    await expect(
      decideComplaintAi(
        db,
        COMPLAINT,
        ANALYSIS,
        {
          decision: 'approved',
          finalAction: 'suspension',
          reason: 'Changed by client.',
          days: 30,
          indefinite: false,
        },
        ADMIN,
        now,
      ),
    ).resolves.toEqual({ kind: 'recommendation_mismatch' });
    await expect(
      decideComplaintAi(
        client({ decision_id: 'e1' }).client,
        COMPLAINT,
        ANALYSIS,
        {
          decision: 'rejected',
          finalAction: 'none',
          reason: 'No action.',
          days: null,
          indefinite: false,
        },
        ADMIN,
        now,
      ),
    ).resolves.toEqual({ kind: 'already_decided' });
    expect(h.warnRider).not.toHaveBeenCalled();
  });
});
