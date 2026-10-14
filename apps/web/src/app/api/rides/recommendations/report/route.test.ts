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
  reason: 'wrong',
};

describe('POST recommendation report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.guard.mockResolvedValue(null);
    h.getCurrentUser.mockResolvedValue({ id: 'viewer-id' });
    h.readJson.mockResolvedValue(valid);
    h.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 'report-id' }] });
  });

  it('requires a signed-in rider', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/report', { method: 'POST' }),
    );
    expect(response.status).toBe(401);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('rejects invalid report reasons and IDs', async () => {
    h.readJson.mockResolvedValue({ ...valid, reason: 'unsure' });
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/report', { method: 'POST' }),
    );
    expect(response.status).toBe(400);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('attaches a report only to the authenticated rider’s matching recommendation', async () => {
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/report', { method: 'POST' }),
    );
    expect(response.status).toBe(201);
    expect(h.query.mock.calls[0][0]).toContain('a.rider_pseudonym = $2');
    expect(h.query.mock.calls[0][0]).toContain('$3::uuid = ANY(a.suggested_ride_ids)');
    expect(h.query.mock.calls[0][0]).not.toContain('user_id');
    expect(h.query.mock.calls[0][1]).toEqual([
      valid.requestId,
      pseudonymizeRecommendationRider('viewer-id'),
      valid.rideId,
      'wrong',
    ]);
  });

  it('does not allow a duplicate report for one request and ride', async () => {
    h.query.mockResolvedValue({ rowCount: 0, rows: [] });
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/report', { method: 'POST' }),
    );
    expect(response.status).toBe(409);
  });

  it('logs persistence failures and returns an explicit server error', async () => {
    const error = new Error('database unavailable');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.query.mockRejectedValue(error);
    const response = await POST(
      new Request('http://localhost/api/rides/recommendations/report', { method: 'POST' }),
    );
    expect(response.status).toBe(500);
    expect(logError).toHaveBeenCalledWith('Save recommendation report failed:', error);
    logError.mockRestore();
  });
});
