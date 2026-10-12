// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getCurrentUser: vi.fn(), guard: vi.fn(), query: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: h.getCurrentUser,
  guard: h.guard,
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('@/lib/db', () => ({ pool: { query: h.query } }));

import { PATCH } from './route';

const request = () => new Request('http://localhost/api/notifications/11111111-1111-4111-8111-111111111111', { method: 'PATCH' });
const context = (id = '11111111-1111-4111-8111-111111111111') => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  h.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  h.guard.mockResolvedValue(null);
  h.query.mockResolvedValue({ rows: [{ id: '11111111-1111-4111-8111-111111111111', read_at: new Date('2026-10-12T10:00:00.000Z') }] });
});

describe('PATCH /api/notifications/[id]', () => {
  it('requires authentication and does not query when signed out', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    expect((await PATCH(request(), context())).status).toBe(401);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('honours the request guard', async () => {
    h.guard.mockResolvedValue(new Response('blocked', { status: 429 }));
    expect((await PATCH(request(), context())).status).toBe(429);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('validates the UUID before querying', async () => {
    expect((await PATCH(request(), context('bad-id'))).status).toBe(404);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('marks only a notification owned by the current user and returns readAt', async () => {
    const response = await PATCH(request(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      notification: { id: '11111111-1111-4111-8111-111111111111', readAt: '2026-10-12T10:00:00.000Z' },
    });
    expect(h.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1 AND user_id = $2'), [
      '11111111-1111-4111-8111-111111111111', 'user-1',
    ]);
    expect(h.query.mock.calls[0][0]).toContain('COALESCE(read_at, now())');
  });

  it('returns the same not-found response for missing or non-owned notifications', async () => {
    h.query.mockResolvedValue({ rows: [] });
    const response = await PATCH(request(), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Notification not found.' });
  });

  it('does not expose database errors', async () => {
    h.query.mockRejectedValue(new Error('private database details'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await PATCH(request(), context());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to update notification right now.' });
  });
});
