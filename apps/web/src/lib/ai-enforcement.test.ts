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
      if (answer.missing_analysis) return { rows: [] };
      return {
        rows: [
          {
            id: ANALYSIS,
            outcome: 'ai_validated',
            recommended_action: 'warning',
            recommended_suspension_days: null,
            recommended_indefinite: false,
            complaint_id: COMPLAINT,
            complaint_status: 'under_review',
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

  it('requires an override to choose an action different from the recommendation', async () => {
    const { client: db, query } = client();
    await expect(
      decideComplaintAi(
        db,
        COMPLAINT,
        ANALYSIS,
        {
          decision: 'overridden',
          finalAction: 'warning',
          reason: 'Admin reviewed the recommendation.',
          days: null,
          indefinite: false,
        },
        ADMIN,
        now,
      ),
    ).resolves.toEqual({ kind: 'recommendation_mismatch' });
    expect(h.warnRider).not.toHaveBeenCalled();
    expect(h.suspendRider).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_enforcement_decisions'),
      ),
    ).toBe(false);

    const differentAction = await decideComplaintAi(
      db,
      COMPLAINT,
      ANALYSIS,
      {
        decision: 'overridden',
        finalAction: 'none',
        reason: 'The evidence does not justify enforcement.',
        days: null,
        indefinite: false,
      },
      ADMIN,
      now,
    );
    expect(differentAction).toMatchObject({
      kind: 'done',
      record: { decision: 'overridden', finalAction: 'none' },
    });
  });

  it('refuses enforcement against a resolved complaint without warning the rider', async () => {
    const { client: db, query } = client({ complaint_status: 'resolved' });
    const result = await decideComplaintAi(
      db,
      COMPLAINT,
      ANALYSIS,
      {
        decision: 'approved',
        finalAction: 'warning',
        reason: 'Approved after review.',
        days: null,
        indefinite: false,
      },
      ADMIN,
      now,
    );

    expect(result).toEqual({ kind: 'complaint_resolved' });
    expect(h.warnRider).not.toHaveBeenCalled();
    expect(h.suspendRider).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_enforcement_decisions'),
      ),
    ).toBe(false);
  });

  it('distinguishes missing and non-validated analyses', async () => {
    await expect(
      decideComplaintAi(
        client({ missing_analysis: true }).client,
        COMPLAINT,
        ANALYSIS,
        {
          decision: 'rejected',
          finalAction: 'none',
          reason: 'Not supported.',
          days: null,
          indefinite: false,
        },
        ADMIN,
        now,
      ),
    ).resolves.toEqual({ kind: 'not_found' });
    await expect(
      decideComplaintAi(
        client({ outcome: 'fallback_invalid', recommended_action: null }).client,
        COMPLAINT,
        ANALYSIS,
        {
          decision: 'rejected',
          finalAction: 'none',
          reason: 'Not supported.',
          days: null,
          indefinite: false,
        },
        ADMIN,
        now,
      ),
    ).resolves.toEqual({ kind: 'invalid_analysis' });
  });

  it('executes an explicitly approved suspension using the validated recommendation', async () => {
    const { client: db } = client({
      recommended_action: 'suspension',
      recommended_suspension_days: 14,
    });
    const result = await decideComplaintAi(
      db,
      COMPLAINT,
      ANALYSIS,
      {
        decision: 'approved',
        finalAction: 'suspension',
        reason: 'Repeated safety violations.',
        days: 14,
        indefinite: false,
      },
      ADMIN,
      now,
    );
    expect(result).toMatchObject({
      kind: 'done',
      record: { decision: 'approved', finalAction: 'suspension', suspensionId: expect.any(String) },
    });
    expect(h.suspendRider).toHaveBeenCalledWith(
      db,
      RIDER,
      {
        reasonCategory: 'safety',
        reason: 'Repeated safety violations.',
        days: 14,
        indefinite: false,
        complaintId: COMPLAINT,
      },
      ADMIN,
      now,
    );
  });

  it('does not save an AI decision when the enforcement write is refused', async () => {
    const { client: db, query } = client();
    h.warnRider.mockResolvedValue({ kind: 'not_found' });
    const result = await decideComplaintAi(
      db,
      COMPLAINT,
      ANALYSIS,
      {
        decision: 'approved',
        finalAction: 'warning',
        reason: 'Reviewed.',
        days: null,
        indefinite: false,
      },
      ADMIN,
      now,
    );
    expect(result).toEqual({ kind: 'enforcement_failed', result: { kind: 'not_found' } });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_enforcement_decisions'),
      ),
    ).toBe(false);
  });
});
