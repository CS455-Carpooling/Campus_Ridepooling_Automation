// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  query: vi.fn(),
  rankWithGemini: vi.fn(),
  rankRideRecommendations: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ pool: { query: h.query } }));
vi.mock('./gemini-ranking', () => ({
  rankWithGemini: h.rankWithGemini,
  GEMINI_MODEL_VERSION: 'model-test-v2',
  GEMINI_PROMPT_VERSION: 'prompt-test-v3',
  RECOMMENDATION_DEADLINE_MS: 1000,
}));
vi.mock('./recommendation-pipeline', () => ({
  rankRideRecommendations: h.rankRideRecommendations,
}));

import { getRideRecommendations } from './recommendations';
import { pseudonymizeRecommendationRider } from './recommendation-audit';
import type { RankingRunner } from './recommendation-pipeline';
import type { SearchRideRequest } from '@/lib/ride-search';

const filters: SearchRideRequest = {
  direction: 'to_hub',
  hubId: 'hub-1',
  campusLocationId: 'hall-3',
  departureStart: '2099-10-10T06:30:00+05:30',
  departureEnd: '2099-10-10T07:30:00+05:30',
};

describe('getRideRecommendations audit records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.query.mockResolvedValue({ rows: [], rowCount: 1 });
    h.rankWithGemini.mockResolvedValue({});
    h.rankRideRecommendations.mockImplementation(
      async (
        _userId: string,
        _filters: SearchRideRequest,
        _runner: unknown,
        onValidation: (status: string) => void,
      ) => {
        onValidation('failed');
        return {
          source: 'fallback',
          suggestions: [
            {
              ride: { id: 'ride-1' },
              pros: [],
              cons: [],
              factors: ['fare'],
            },
          ],
        };
      },
    );
  });

  it('stores pseudonymized rider identity and the complete, truthful oversight metadata', async () => {
    const result = await getRideRecommendations('rider-user-id', filters);
    const insert = h.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ride_recommendation_audits'),
    );
    expect(insert).toBeDefined();
    expect(insert?.[0]).toContain('rider_pseudonym');
    expect(insert?.[0]).toContain('output_validation_outcome');
    expect(insert?.[0]).toContain('fallback_used');
    expect(insert?.[0]).toContain("'[]'::jsonb");
    expect(insert?.[0]).not.toContain('user_id');
    expect(insert?.[1]).toEqual([
      result.requestId,
      pseudonymizeRecommendationRider('rider-user-id'),
      'model-test-v2',
      'prompt-test-v3',
      'fallback_invalid',
      'failed',
      true,
      ['ride-1'],
      expect.any(Number),
      null,
      null,
    ]);
    expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(h.query.mock.calls[0][0]).toContain("interval '90 days'");
  });

  it('stores provider token counts when the model reports usage', async () => {
    h.rankWithGemini.mockResolvedValue({
      rankedRides: [],
      __usageMetadata: { inputTokens: 24, outputTokens: 9 },
    });
    h.rankRideRecommendations.mockImplementation(
      async (
        _userId: string,
        _filters: SearchRideRequest,
        runner: RankingRunner,
        onValidation: (status: 'passed' | 'failed' | 'not_run') => void,
      ) => {
        await runner({} as Parameters<RankingRunner>[0]);
        onValidation('passed');
        return {
          source: 'ai',
          suggestions: [{ ride: { id: 'ride-1' }, pros: [], cons: [], factors: ['fare'] }],
        };
      },
    );

    await getRideRecommendations('rider-user-id', filters);
    const insert = h.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ride_recommendation_audits'),
    );
    expect(insert?.[1][4]).toBe('ai_validated');
    expect(insert?.[1][5]).toBe('passed');
    expect(insert?.[1][6]).toBe(false);
    expect(insert?.[1][9]).toBe(24);
    expect(insert?.[1][10]).toBe(9);
  });
});
