import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { rankWithGemini, REQUEST_TIMEOUT_MS } from './gemini-ranking';
import type { RecommendationRequest } from './types';

const request: RecommendationRequest = {
  filters: {
    direction: 'to_hub',
    departureStart: '2026-11-12T08:00:00+05:30',
    departureEnd: '2026-11-12T09:00:00+05:30',
    vehicleTypeId: 'car',
    maxFareShare: 500,
  },
  candidates: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('rankWithGemini timeout', () => {
  it('aborts the provider request at the shared 20-second timeout', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [{ content: { parts: [{ text: '{"rankedRides":[]}' }] } }],
        }),
      ),
    );

    await rankWithGemini(request);

    expect(REQUEST_TIMEOUT_MS).toBe(20_000);
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
  });
});
