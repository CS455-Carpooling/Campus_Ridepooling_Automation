// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  readJson: vi.fn(),
  getRideRecommendations: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  json: h.json,
  readJson: h.readJson,
}));
vi.mock('@/lib/ai/recommendations', () => ({
  getRideRecommendations: h.getRideRecommendations,
}));

import { POST } from './route';

const validFilters = {
  direction: 'to_hub',
  hubId: 'kanpur-central',
  campusLocationId: 'hall-3',
  departureStart: '2099-10-10T06:30:00+05:30',
  departureEnd: '2099-10-10T07:30:00+05:30',
  maxFareShare: 200,
};

describe('POST /api/rides/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.guard.mockResolvedValue(null);
    h.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    h.readJson.mockResolvedValue(validFilters);
    h.getRideRecommendations.mockResolvedValue({ source: 'fallback', suggestions: [] });
  });

  it('requires authentication', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    const response = await POST(new Request('http://localhost/api/rides/recommendations', { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(h.getRideRecommendations).not.toHaveBeenCalled();
  });

  it('rejects invalid search filters', async () => {
    h.readJson.mockResolvedValue({ ...validFilters, direction: 'anywhere' });
    const response = await POST(new Request('http://localhost/api/rides/recommendations', { method: 'POST' }));
    expect(response.status).toBe(400);
    expect(h.getRideRecommendations).not.toHaveBeenCalled();
  });

  it('calls the recommendation service with authenticated user and validated filters', async () => {
    const result = { source: 'fallback', suggestions: [] };
    h.getRideRecommendations.mockResolvedValue(result);
    const response = await POST(new Request('http://localhost/api/rides/recommendations', { method: 'POST' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(h.getRideRecommendations).toHaveBeenCalledWith('user-1', validFilters);
  });

  it('returns a safe error when the service fails', async () => {
    h.getRideRecommendations.mockRejectedValue(new Error('internal detail'));
    const response = await POST(new Request('http://localhost/api/rides/recommendations', { method: 'POST' }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to generate ride recommendations right now.' });
  });
});
