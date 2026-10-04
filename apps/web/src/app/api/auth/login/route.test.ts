// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  query: vi.fn(),
  guard: vi.fn(),
  rateLimit: vi.fn(),
  verifyPassword: vi.fn(),
  fakeVerify: vi.fn(),
  createSession: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { query: m.query } }));
vi.mock('@/lib/auth', () => ({
  normalizeEmail: (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  readJson: async (req: Request) => req.json(),
  json: (body: object, status = 200) => Response.json(body, { status }),
  guard: m.guard,
  rateLimit: m.rateLimit,
  verifyPassword: m.verifyPassword,
  fakeVerify: m.fakeVerify,
  createSession: m.createSession,
  cleanup: m.cleanup,
}));

import { POST } from './route';

const post = (body: Record<string, unknown>) =>
  POST(new Request('http://localhost/api/auth/login', { method: 'POST', body: JSON.stringify(body) }));
const creds = { email: 'A@iitk.ac.in', password: 'password123' };

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.guard.mockResolvedValue(null);
  m.rateLimit.mockResolvedValue(true);
  m.cleanup.mockResolvedValue(undefined);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/auth/login', () => {
  it('returns the guard response when blocked', async () => {
    m.guard.mockResolvedValue(new Response('no', { status: 429 }));
    expect((await post(creds)).status).toBe(429);
  });

  it.each([
    ['email', { password: 'x' }],
    ['password', { email: 'a@iitk.ac.in' }],
  ])('rejects a missing %s with 401', async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(401);
    expect(m.rateLimit).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-email limit is hit', async () => {
    m.rateLimit.mockResolvedValue(false);
    expect((await post(creds)).status).toBe(429);
    expect(m.rateLimit).toHaveBeenCalledWith('login:a@iitk.ac.in', 10, 900);
  });

  it('spends equal time and returns 401 for an unknown email', async () => {
    m.query.mockResolvedValueOnce({ rows: [] });
    const res = await post(creds);
    expect(res.status).toBe(401);
    expect(m.fakeVerify).toHaveBeenCalledWith('password123');
    expect(m.createSession).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong password', async () => {
    m.query.mockResolvedValueOnce({ rows: [{ id: 'u1', password_hash: 'h', email_verified_at: new Date() }] });
    m.verifyPassword.mockResolvedValue(false);
    expect((await post(creds)).status).toBe(401);
    expect(m.createSession).not.toHaveBeenCalled();
  });

  it('returns 403 when the email is not verified yet', async () => {
    m.query.mockResolvedValueOnce({ rows: [{ id: 'u1', password_hash: 'h', email_verified_at: null }] });
    m.verifyPassword.mockResolvedValue(true);
    const res = await post(creds);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/verify your email/);
  });

  it('creates a session on success and honours "remember"', async () => {
    m.query.mockResolvedValue({ rows: [{ id: 'u1', password_hash: 'h', email_verified_at: new Date() }] });
    m.verifyPassword.mockResolvedValue(true);
    expect(await (await post({ ...creds, remember: true })).json()).toEqual({ ok: true });
    expect(m.createSession).toHaveBeenLastCalledWith('u1', true);
    await post({ ...creds, remember: 'yes' });
    expect(m.createSession).toHaveBeenLastCalledWith('u1', false);
    expect(m.cleanup).not.toHaveBeenCalled();
  });

  it('occasionally runs cleanup, and ignores its failures', async () => {
    m.query.mockResolvedValue({ rows: [{ id: 'u1', password_hash: 'h', email_verified_at: new Date() }] });
    m.verifyPassword.mockResolvedValue(true);
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    m.cleanup.mockRejectedValue(new Error('db down'));
    expect((await post(creds)).status).toBe(200);
    expect(m.cleanup).toHaveBeenCalledTimes(1);
  });

  it('truncates very long passwords to 128 characters', async () => {
    m.query.mockResolvedValue({ rows: [{ id: 'u1', password_hash: 'h', email_verified_at: new Date() }] });
    m.verifyPassword.mockResolvedValue(true);
    await post({ ...creds, password: 'p'.repeat(500) });
    expect(m.verifyPassword.mock.calls[0][0]).toHaveLength(128);
  });
});
