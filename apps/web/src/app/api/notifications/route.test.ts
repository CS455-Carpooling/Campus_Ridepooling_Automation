// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getCurrentUser: vi.fn(), query: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: h.getCurrentUser,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/db', () => ({ pool: { query: h.query } }));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  h.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  h.query.mockResolvedValue({ rows: [] });
});

describe('GET /api/notifications', () => {
  it('requires authentication', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    expect((await GET(new Request('http://localhost/api/notifications'))).status).toBe(401);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('lists only the current user notifications newest first with default pagination', async () => {
    h.query.mockResolvedValue({
      rows: [
        {
          id: 'n1',
          type: 'ride_update',
          title: 'Ride updated',
          body: 'Your ride changed',
          related_ride_id: null,
          related_chat_id: null,
          related_message_id: null,
          read_at: null,
          created_at: new Date('2026-10-12T10:00:00.000Z'),
        },
      ],
    });
    const response = await GET(new Request('http://localhost/api/notifications'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      notifications: [
        {
          id: 'n1',
          type: 'ride_update',
          title: 'Ride updated',
          body: 'Your ride changed',
          relatedRideId: null,
          relatedChatId: null,
          relatedMessageId: null,
          readAt: null,
          createdAt: '2026-10-12T10:00:00.000Z',
        },
      ],
      pagination: { limit: 20, offset: 0, hasMore: false },
    });
    expect(h.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1'), [
      'user-1',
      21,
      0,
    ]);
    expect(h.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC, id DESC');
  });

  it('supports validated pagination and detects another page', async () => {
    h.query.mockResolvedValue({
      rows: Array.from({ length: 3 }, (_, i) => ({
        id: `n${i}`,
        type: 'ride_update',
        title: 'Title',
        body: 'Body',
        related_ride_id: null,
        related_chat_id: null,
        related_message_id: null,
        read_at: null,
        created_at: new Date('2026-10-12T10:00:00.000Z'),
      })),
    });
    const response = await GET(new Request('http://localhost/api/notifications?limit=2&offset=4'));
    expect(response.status).toBe(200);
    expect((await response.json()).pagination).toEqual({ limit: 2, offset: 4, hasMore: true });
    expect(h.query).toHaveBeenCalledWith(expect.any(String), ['user-1', 3, 4]);
  });

  it.each(['0', '101', '-1', 'abc', '1.5'])('rejects invalid limit %s', async (limit) => {
    expect(
      (await GET(new Request(`http://localhost/api/notifications?limit=${limit}`))).status,
    ).toBe(400);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('returns a generic error when the database fails', async () => {
    h.query.mockRejectedValue(new Error('private database details'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await GET(new Request('http://localhost/api/notifications'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to retrieve notifications right now.' });
  });
});
