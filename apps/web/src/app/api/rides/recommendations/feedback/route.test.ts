// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  getCurrentUser: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  readJson: vi.fn(),
  query: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  guard: h.guard,
  getCurrentUser: h.getCurrentUser,
  json: h.json,
  readJson: h.readJson,
}));
vi.mock('@/lib/db', () => ({ pool: { query: h.query } }));

import { POST } from './route';
import { pseudonymizeRecommendationRider } from '@/lib/ai/recommendation-audit';

const valid = {
  requestId: '8f1b2c3d-4e5f-4678-9123-abcdefabcdef',
  rideId: '7f1b2c3d-4e5f-4678-9123-abcdefabcdef',
  value: 'helpful',
};

describe('POST recommendation feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.guard.mockResolvedValue(null);
    h.getCurrentUser.mockResolvedValue({ id: 'viewer-id' });
    h.readJson.mockResolvedValue(valid);
    h.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 'feedback-id' }] });
  });

  it('requires authentication', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/feedback', { method: 'POST' }),
    );
    expect(response.status).toBe(401);
  });

  it('rejects invalid feedback values', async () => {
    h.readJson.mockResolvedValue({ ...valid, value: 'maybe' });
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/feedback', { method: 'POST' }),
    );
    expect(response.status).toBe(400);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('stores authenticated feedback', async () => {
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/feedback', { method: 'POST' }),
    );
    expect(response.status).toBe(201);
    expect(h.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
      valid.requestId,
      pseudonymizeRecommendationRider('viewer-id'),
      valid.rideId,
      'helpful',
    ]);
    expect(h.query.mock.calls[0][0]).toContain('a.rider_pseudonym = $2');
    expect(h.query.mock.calls[0][0]).toContain('ANY(a.suggested_ride_ids)');
    expect(h.query.mock.calls[0][0]).not.toContain('user_id');
  });

  it('returns conflict for duplicate or ineligible feedback', async () => {
    h.query.mockResolvedValue({ rowCount: 0, rows: [] });
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/feedback', { method: 'POST' }),
    );
    expect(response.status).toBe(409);
  });

  it('logs persistence failures and returns an explicit server error', async () => {
    const error = new Error('database unavailable');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.query.mockRejectedValue(error);
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/feedback', { method: 'POST' }),
    );
    expect(response.status).toBe(500);
    expect(logError).toHaveBeenCalledWith('Save recommendation feedback failed:', error);
    logError.mockRestore();
  });
});
