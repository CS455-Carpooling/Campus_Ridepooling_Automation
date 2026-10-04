// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  query: vi.fn(),
  guard: vi.fn(),
  rateLimit: vi.fn(),
  hashPassword: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { query: m.query } }));
vi.mock('@/lib/auth', () => ({
  EMAIL_RE: /^[a-z0-9._%+-]+@iitk\.ac\.in$/,
  normalizeEmail: (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  readJson: async (req: Request) => req.json(),
  json: (body: object, status = 200) => Response.json(body, { status }),
  appUrl: () => 'http://localhost:3000',
  guard: m.guard,
  rateLimit: m.rateLimit,
  hashPassword: m.hashPassword,
  sendVerificationEmail: m.sendVerificationEmail,
  sendMail: m.sendMail,
}));

import { POST } from './route';

const valid = {
  email: 'Ananya@iitk.ac.in',
  name: '  Ananya   Rao ',
  roll: '220123',
  password: 'password123',
  terms: true,
};
const post = (body: Record<string, unknown>) =>
  POST(new Request('http://localhost/api/auth/register', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.guard.mockResolvedValue(null);
  m.rateLimit.mockResolvedValue(true);
  m.hashPassword.mockResolvedValue('hash');
});

describe('POST /api/auth/register', () => {
  it('returns the guard response when the request is blocked', async () => {
    m.guard.mockResolvedValue(new Response('no', { status: 403 }));
    expect((await post(valid)).status).toBe(403);
    expect(m.query).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-IITK email', { email: 'a@gmail.com' }, /iitk\.ac\.in/],
    ['a too-short name', { name: 'A' }, /full name/],
    ['a too-long name', { name: 'A'.repeat(81) }, /full name/],
    ['an invalid roll number', { roll: '!!' }, /roll number/],
    ['a short password', { password: 'short' }, /8 to 128/],
    ['a long password', { password: 'p'.repeat(129) }, /8 to 128/],
    ['missing terms', { terms: false }, /guidelines/],
  ])('rejects %s with 400', async (_, patch, message) => {
    const res = await post({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(message);
    expect(m.query).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-email limit is exceeded', async () => {
    m.rateLimit.mockResolvedValue(false);
    expect((await post(valid)).status).toBe(429);
    expect(m.rateLimit).toHaveBeenCalledWith('register:ananya@iitk.ac.in', 3, 3600);
  });

  it('creates a new user with normalised fields and sends a verification email', async () => {
    m.query.mockResolvedValueOnce({ rows: [{ id: 'u1' }] });
    const res = await post(valid);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.query.mock.calls[0][1]).toEqual(['ananya@iitk.ac.in', 'Ananya Rao', '220123', 'hash']);
    expect(m.sendVerificationEmail).toHaveBeenCalledWith('u1', 'ananya@iitk.ac.in');
  });

  it('re-sends verification for an existing unverified account', async () => {
    m.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'u2', email_verified_at: null }] });
    expect((await post(valid)).status).toBe(200);
    expect(m.sendVerificationEmail).toHaveBeenCalledWith('u2', 'ananya@iitk.ac.in');
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it('emails a notice for an existing verified account, with the same response', async () => {
    m.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'u3', email_verified_at: new Date() }] });
    const res = await post(valid);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.sendMail).toHaveBeenCalledWith(
      'ananya@iitk.ac.in',
      'You already have an account',
      expect.stringContaining('http://localhost:3000/forgot-password'),
    );
    expect(m.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('sends nothing if the conflicting row can no longer be found', async () => {
    m.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    expect((await post(valid)).status).toBe(200);
    expect(m.sendMail).not.toHaveBeenCalled();
    expect(m.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
