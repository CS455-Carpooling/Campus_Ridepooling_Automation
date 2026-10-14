import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  query: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));

vi.mock('@/lib/db', () => ({
  pool: { query: mocks.query },
}));

import { GET } from './route';

describe('GET /api/me/ride-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: 'rider-1' });
  });

  it('rejects unauthenticated users', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('unauthenticated');
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('returns an empty list when the rider has no requests', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ requests: [] });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual(['rider-1']);
  });

  it('returns requests with their status history', async () => {
    const submittedAt = new Date('2026-10-12T10:00:00Z');
    const changedAt = new Date('2026-10-12T10:05:00Z');

    mocks.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'request-1',
            ride_id: 'ride-1',
            pickup_location_id: 'hall-1',
            status: 'accepted',
            snapshot_departure_start: new Date('2026-10-13T10:00:00Z'),
            snapshot_pickup_at: new Date('2026-10-13T09:45:00Z'),
            snapshot_estimated_share: 250,
            reason_code: null,
            submitted_at: submittedAt,
            updated_at: changedAt,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'history-1',
            request_id: 'request-1',
            previous_status: null,
            new_status: 'pending',
            reason_code: 'request_submitted',
            changed_at: submittedAt,
          },
          {
            id: 'history-2',
            request_id: 'request-1',
            previous_status: 'pending',
            new_status: 'accepted',
            reason_code: null,
            changed_at: changedAt,
          },
        ],
      });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0]).toMatchObject({
      id: 'request-1',
      rideId: 'ride-1',
      pickupPointId: 'hall-1',
      status: 'accepted',
      departureSnapshot: '2026-10-13T10:00:00.000Z',
      pickupTimeSnapshot: '2026-10-13T09:45:00.000Z',
      estimatedShare: 250,
    });
    expect(body.requests[0].history).toHaveLength(2);
    expect(body.requests[0].history[0]).toMatchObject({
      previousStatus: null,
      newStatus: 'pending',
      reasonCode: 'request_submitted',
      changedBy: null,
    });
    expect(body.requests[0].history[1].newStatus).toBe('accepted');
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls[0][0]).toContain('pickup_location_id');
    expect(mocks.query.mock.calls[0][0]).toContain('snapshot_departure_start');
    expect(mocks.query.mock.calls[1][0]).toContain('FROM ride_join_request_events');
    expect(mocks.query.mock.calls[1][1]).toEqual([['request-1']]);
  });

  it('returns a server error when the database query fails', async () => {
    mocks.query.mockRejectedValueOnce(new Error('Database unavailable'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await GET();

      expect(response.status).toBe(500);
      expect((await response.json()).code).toBe('ride_requests_fetch_failed');
    } finally {
      consoleError.mockRestore();
    }
  });
});
