// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  query: vi.fn(),
  guard: vi.fn(),
  consumeToken: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { query: m.query } }));
vi.mock('@/lib/auth', () => ({
  readJson: async (req: Request) => req.json(),
  json: (body: object, status = 200) => Response.json(body, { status }),
  guard: m.guard,
  consumeToken: m.consumeToken,
  hashPassword: m.hashPassword,
}));

import { POST } from './route';

const post = (body: Record<string, unknown>) =>
  POST(new Request('http://localhost/api/auth/reset', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.guard.mockResolvedValue(null);
  m.hashPassword.mockResolvedValue('newhash');
});

describe('POST /api/auth/reset', () => {
  it('returns the guard response when blocked', async () => {
    m.guard.mockResolvedValue(new Response('no', { status: 403 }));
    expect((await post({ token: 't', password: 'password123' })).status).toBe(403);
  });

  it.each([['short'], ['p'.repeat(129)]])('rejects a bad password length with 400', async (password) => {
    expect((await post({ token: 't', password })).status).toBe(400);
    expect(m.consumeToken).not.toHaveBeenCalled();
  });

  it('rejects a missing token without consuming anything', async () => {
    const res = await post({ password: 'password123' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid or has expired/);
    expect(m.consumeToken).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    m.consumeToken.mockResolvedValue(null);
    expect((await post({ token: 't', password: 'password123' })).status).toBe(400);
    expect(m.query).not.toHaveBeenCalled();
  });

  it('updates the password and signs the user out everywhere', async () => {
    m.consumeToken.mockResolvedValue('u1');
    m.query.mockResolvedValue({ rows: [] });
    const res = await post({ token: 'tok', password: 'password123' });
    expect(await res.json()).toEqual({ ok: true });
    expect(m.consumeToken).toHaveBeenCalledWith('tok', 'reset');
    expect(m.query.mock.calls[0][1]).toEqual(['newhash', 'u1']);
    expect(m.query.mock.calls[1][0]).toMatch(/DELETE FROM sessions/);
    expect(m.query.mock.calls[1][1]).toEqual(['u1']);
  });
});
