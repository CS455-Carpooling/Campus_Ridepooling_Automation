// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('./db', () => ({ pool: { query: h.query } }));

import { listRecommendationAudits } from './admin-recommendation-audits';

describe('listRecommendationAudits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.query.mockResolvedValue({
      rows: [
        {
          request_id: 'request-1',
          rider_pseudonym: 'a'.repeat(64),
          model_version: 'model-v1',
          prompt_version: 'prompt-v1',
          outcome: 'fallback_invalid',
          output_validation_outcome: 'failed',
          fallback_used: true,
          tool_call_count: 0,
          latency_ms: 123,
          input_tokens: null,
          output_tokens: 12,
          created_at: new Date('2026-10-12T00:00:00Z'),
          reports: [
            {
              id: 'report-1',
              ride_id: 'ride-1',
              reason: 'inappropriate',
              created_at: '2026-10-12T00:01:00.000Z',
            },
          ],
        },
      ],
    });
  });

  it('returns audit metadata and reports without rider contact or profile data', async () => {
    const rows = await listRecommendationAudits();
    expect(rows[0]).toMatchObject({
      requestId: 'request-1',
      riderPseudonym: 'a'.repeat(64),
      validationOutcome: 'failed',
      fallbackUsed: true,
      toolCallCount: 0,
      reports: [{ id: 'report-1', rideId: 'ride-1', reason: 'inappropriate' }],
    });
    const sql = h.query.mock.calls[0][0] as string;
    expect(sql).toContain("interval '90 days'");
    expect(sql).toContain('r.request_id = a.request_id');
    expect(sql).not.toMatch(/users|user_profiles|email|phone|user_id/i);
  });
});
