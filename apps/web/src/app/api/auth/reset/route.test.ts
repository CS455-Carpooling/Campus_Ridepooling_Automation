// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
  guard: vi.fn(),
  consumeToken: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  pool: { query: m.query, connect: m.connect },
}));
vi.mock('@/lib/auth', () => ({
  readJson: async (req: Request) => req.json(),
  json: (body: object, status = 200) => Response.json(body, { status }),
  guard: m.guard,
  consumeToken: m.consumeToken,
  hashPassword: m.hashPassword,
}));

import { POST } from './route';

const post = (body: Record<string, unknown>) =>
  POST(
    new Request('http://localhost/api/auth/reset', { method: 'POST', body: JSON.stringify(body) }),
  );

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.guard.mockResolvedValue(null);
  m.hashPassword.mockResolvedValue('newhash');
  m.connect.mockResolvedValue({ query: m.clientQuery, release: m.release });
  m.clientQuery.mockResolvedValue({ rows: [], rowCount: 1 });
});

describe('POST /api/auth/reset', () => {
  it('returns the guard response when blocked', async () => {
    m.guard.mockResolvedValue(new Response('no', { status: 403 }));
    expect((await post({ token: 't', password: 'password123' })).status).toBe(403);
  });

  it.each([['short'], ['p'.repeat(129)]])(
    'rejects a bad password length with 400',
    async (password) => {
      expect((await post({ token: 't', password })).status).toBe(400);
      expect(m.consumeToken).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing token without consuming anything', async () => {
    const res = await post({ password: 'password123' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid or has expired/);
    expect(m.consumeToken).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    m.consumeToken.mockResolvedValue(null);
    expect((await post({ token: 't', password: 'password123' })).status).toBe(400);
    expect(m.clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('updates the password and signs the user out everywhere', async () => {
    m.consumeToken.mockImplementation(async (_token, _purpose, executor) => {
      await executor.query(
        'DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING user_id',
      );
      return 'u1';
    });
    m.clientQuery
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }] })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    const res = await post({ token: 'tok', password: 'password123' });
    expect(await res.json()).toEqual({ ok: true });
    expect(m.consumeToken).toHaveBeenCalledWith('tok', 'reset', expect.any(Object));
    expect(m.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      expect.stringMatching(/DELETE FROM auth_tokens/),
      expect.stringMatching(/UPDATE users/),
      expect.stringMatching(/DELETE FROM sessions/),
      'COMMIT',
    ]);
  });

  it('fails before opening a transaction when password hashing fails', async () => {
    m.consumeToken.mockResolvedValue('u1');
    m.hashPassword.mockRejectedValue(new Error('hash failed'));
    const res = await post({ token: 'tok', password: 'password123' });
    expect(res.status).toBe(500);
    expect(m.connect).not.toHaveBeenCalled();
    expect(m.consumeToken).not.toHaveBeenCalled();
  });
});
