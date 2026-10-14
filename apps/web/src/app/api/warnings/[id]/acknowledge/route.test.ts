// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  guard: vi.fn(),
  json: vi.fn((body: unknown, status = 200) => Response.json(body, { status })),
  query: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: h.getCurrentUser,
  guard: h.guard,
  json: h.json,
}));
vi.mock('@/lib/db', () => ({ pool: { query: h.query } }));

import { POST } from './route';

const USER = '6f1c2a5e-2222-4000-8000-000000000001';
const WARNING = '6f1c2a5e-2222-4000-8000-000000000002';
const ctx = (id = WARNING) => ({ params: Promise.resolve({ id }) }) as never;
const request = () =>
  new Request('http://localhost/api/warnings/id/acknowledge', { method: 'POST' });

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.getCurrentUser.mockResolvedValue({ id: USER });
  h.query.mockResolvedValue({ rows: [{ id: WARNING }] });
});

describe('POST warning acknowledgement', () => {
  it('requires authentication and allows profile-incomplete riders with pending warnings', async () => {
    h.getCurrentUser.mockResolvedValue(null);
    expect((await POST(request(), ctx())).status).toBe(401);
    expect(h.getCurrentUser).toHaveBeenCalledWith({
      allowIncompleteProfile: true,
      allowUnacknowledgedWarnings: true,
    });
    expect(h.query).not.toHaveBeenCalled();
  });

  it('acknowledges only a warning belonging to the current rider', async () => {
    const response = await POST(request(), ctx());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ acknowledged: true });
    expect(h.query.mock.calls[0][0]).toContain('WHERE id = $1 AND user_id = $2');
    expect(h.query.mock.calls[0][1]).toEqual([WARNING, USER]);
  });

  it('returns success for an already acknowledged warning', async () => {
    h.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ acknowledged: true }] });
    expect((await POST(request(), ctx())).status).toBe(200);
    expect(h.query).toHaveBeenCalledTimes(2);
  });

  it('does not disclose another rider’s warning', async () => {
    h.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    expect((await POST(request(), ctx())).status).toBe(404);
  });

  it('rejects malformed warning IDs', async () => {
    expect((await POST(request(), ctx('bad-id'))).status).toBe(404);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('logs persistence failures', async () => {
    const error = new Error('database unavailable');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.query.mockRejectedValue(error);
    expect((await POST(request(), ctx())).status).toBe(500);
    expect(logError).toHaveBeenCalledWith('Acknowledge rider warning failed:', error);
    logError.mockRestore();
  });
});
